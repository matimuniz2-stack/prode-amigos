"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SubmitResult = { ok: true } | { ok: false; error: string };

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
    .select("id, status, lock_at, home_team_id, away_team_id, stage:stages(code)")
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

  // La relación stage puede venir como objeto o array; la normalizamos.
  const stageRel = match.stage as unknown;
  const stageCode = Array.isArray(stageRel)
    ? (stageRel[0] as { code?: string } | undefined)?.code
    : (stageRel as { code?: string } | null)?.code;
  const isKO = !!stageCode && stageCode !== "group";

  // En eliminación guardamos quién pasa: si no es empate, el del marcador;
  // si empataron en los 90', el que eligió el usuario.
  let koWinnerId: string | null = null;
  if (isKO) {
    if (home > away) {
      koWinnerId = match.home_team_id;
    } else if (away > home) {
      koWinnerId = match.away_team_id;
    } else {
      const k = formData.get("koWinner");
      if (
        typeof k === "string" &&
        (k === match.home_team_id || k === match.away_team_id)
      ) {
        koWinnerId = k;
      } else {
        return { ok: false, error: "Es eliminación y empataron: elegí quién pasa." };
      }
    }
  }

  const payload = {
    user_id: userId,
    match_id: matchId,
    predicted_winner: winner,
    predicted_home: home,
    predicted_away: away,
    predicted_ko_winner_team_id: koWinnerId,
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
  return { ok: true };
}
