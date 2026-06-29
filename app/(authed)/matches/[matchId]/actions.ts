"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidateScoring } from "@/lib/supabase/cached";
import { isReactionEmoji } from "@/lib/reactions";

export type SubmitResult =
  | { ok: true; fechaDone?: boolean; fechaTotal?: number }
  | { ok: false; error: string };

function clampScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0 || i > 20) return null;
  return i;
}

export async function submitPick(
  matchId: string,
  formData: FormData,
): Promise<SubmitResult> {
  const home = clampScore(formData.get("home"));
  const away = clampScore(formData.get("away"));
  if (home === null || away === null) {
    return { ok: false, error: "El score debe ser un entero entre 0 y 20." };
  }
  const winner = home > away ? "home" : home < away ? "away" : "draw";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, status, lock_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr || !match) {
    return { ok: false, error: "No encontré el partido." };
  }
  if (match.status === "pending_bracket") {
    return { ok: false, error: "Todavía se está definiendo el cruce." };
  }
  if (new Date(match.lock_at).getTime() <= Date.now()) {
    return { ok: false, error: "Ya cerró el deadline de este partido." };
  }

  // En eliminación el puntaje sale del resultado de los 120' (igual que grupos);
  // no guardamos quién pasa por penales — no afecta el puntaje.
  const payload = {
    user_id: userId,
    match_id: matchId,
    predicted_winner: winner,
    predicted_home: home,
    predicted_away: away,
    predicted_ko_winner_team_id: null,
    is_auto_random: false,
    state: "open",
  };

  const { error: upsertErr } = await supabase
    .from("match_predictions")
    .upsert(payload, { onConflict: "user_id,match_id" });

  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
  revalidatePath("/mi-prode");
  revalidatePath("/dashboard");
  revalidateScoring();

  // ¿Quedó completa la fecha? = todos los partidos todavía abiertos (no
  // cerrados ni terminados) tienen pick del usuario. Para el festejo "todo
  // listo". La tabla matches es chica (~104 filas) así que filtramos en JS.
  let fechaDone = false;
  let fechaTotal = 0;
  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, status, lock_at");
  const openIds = (allMatches ?? [])
    .filter(
      (m) =>
        new Date(m.lock_at).getTime() > Date.now() &&
        !["finished", "cancelled", "void", "pending_bracket"].includes(
          m.status,
        ),
    )
    .map((m) => m.id);
  fechaTotal = openIds.length;
  if (openIds.length > 0) {
    const { data: myPicks } = await supabase
      .from("match_predictions")
      .select("match_id")
      .eq("user_id", userId)
      .in("match_id", openIds);
    const have = new Set((myPicks ?? []).map((p) => p.match_id));
    fechaDone = have.size >= openIds.length;
  }

  return { ok: true, fechaDone, fechaTotal };
}

export async function sendChatMessage(
  matchId: string,
  formData: FormData,
): Promise<SubmitResult> {
  const raw = formData.get("content");
  const content = typeof raw === "string" ? raw.trim() : "";
  if (content.length < 1) {
    return { ok: false, error: "Escribí algo." };
  }
  if (content.length > 280) {
    return { ok: false, error: "Máximo 280 caracteres." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;

  // La RLS valida que el partido esté cerrado; igual chequeamos para dar un
  // error lindo en vez del 42501.
  const { data: match } = await supabase
    .from("matches")
    .select("lock_at, status")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "No encontré el partido." };
  if (new Date(match.lock_at).getTime() > Date.now()) {
    return { ok: false, error: "El chat se abre cuando cierra el partido." };
  }

  const { error } = await supabase
    .from("match_chat_messages")
    .insert({ match_id: matchId, user_id: userId, content });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

export async function toggleReaction(
  matchId: string,
  targetUserId: string,
  emoji: string,
): Promise<SubmitResult> {
  if (!isReactionEmoji(emoji)) {
    return { ok: false, error: "Emoji no permitido." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const userId = claims.claims.sub as string;
  if (userId === targetUserId) {
    return { ok: false, error: "No te podés reaccionar a vos mismo." };
  }

  // Toggle: si ya existe la reacción, la saco; si no, la agrego.
  const { data: existing } = await supabase
    .from("pick_reactions")
    .select("id")
    .eq("match_id", matchId)
    .eq("target_user_id", targetUserId)
    .eq("reactor_user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("pick_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("pick_reactions").insert({
      match_id: matchId,
      target_user_id: targetUserId,
      reactor_user_id: userId,
      emoji,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/sala-en-vivo");
  return { ok: true };
}
