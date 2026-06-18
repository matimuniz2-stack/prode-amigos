// Recordatorio pre-cierre: ~1h antes de que cierre un partido, le avisa por
// push a los jugadores que TODAVÍA no cargaron su pick (antes de que les vaya
// el auto-random 🎲). Lo dispara pg_cron (invoke_push_reminders) con el secret
// del Vault como Bearer — mismo patrón que poll-results.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^bearer\s+/i, "").trim();
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "no auth" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "falta service-role" },
      { status: 200 },
    );
  }
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  // Ventana de 15 min: con el cron cada 15 min, cada partido cae en ella una
  // sola vez (≈1h antes del cierre) → un recordatorio por partido, sin repetir.
  const now = Date.now();
  const fromIso = new Date(now + 50 * 60 * 1000).toISOString();
  const toIso = new Date(now + 65 * 60 * 1000).toISOString();

  const { data: matches, error: mErr } = await sb
    .from("matches")
    .select("id, lock_at, status")
    .eq("status", "scheduled")
    .gt("lock_at", fromIso)
    .lte("lock_at", toIso);
  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  }
  const openIds = (matches ?? []).map((m) => m.id);
  if (openIds.length === 0) {
    return NextResponse.json({ ok: true, matches: 0, notified: 0 });
  }

  const [
    { data: realPicks, error: rpErr },
    { data: globals, error: gErr },
    { data: picks, error: pErr },
  ] = await Promise.all([
    // Participante = cargó al menos UN pronóstico real (mismo criterio que el
    // auto-random: solo a ellos les va random, así que solo a ellos tiene
    // sentido recordarles). Asume 1 torneo activo (multi-liga es a futuro).
    sb.from("match_predictions").select("user_id").eq("is_auto_random", false),
    sb.from("global_predictions").select("user_id"),
    sb.from("match_predictions").select("user_id, match_id").in("match_id", openIds),
  ]);
  if (rpErr || gErr || pErr) {
    return NextResponse.json({ ok: false, error: "db error" }, { status: 500 });
  }

  const participants = new Set<string>();
  for (const r of realPicks ?? []) participants.add(r.user_id);
  for (const g of globals ?? []) participants.add(g.user_id);

  // Quién tiene pick para cada partido abierto.
  const haveByUser = new Map<string, Set<string>>();
  for (const p of picks ?? []) {
    const set = haveByUser.get(p.user_id) ?? new Set<string>();
    set.add(p.match_id);
    haveByUser.set(p.user_id, set);
  }
  // Faltan: PARTICIPANTES sin pick en al menos uno de los partidos que cierran.
  const missing = [...participants].filter((uid) => {
    const have = haveByUser.get(uid);
    return openIds.some((mid) => !have || !have.has(mid));
  });

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, matches: openIds.length, notified: 0 });
  }

  const count = openIds.length;
  const result = await sendPushToUsers(missing, {
    title: "⏰ ¡Cierra en menos de 1h!",
    body:
      count === 1
        ? "Te falta cargar un pick. Metelo antes de que vaya random 🎲"
        : `Te faltan picks de ${count} partidos. Cargalos antes del cierre 🎲`,
    url: "/matches",
    tag: "pre-cierre",
  });

  return NextResponse.json({
    ok: true,
    matches: count,
    missing: missing.length,
    ...result,
  });
}
