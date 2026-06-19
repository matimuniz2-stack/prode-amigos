"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { revalidateScoring } from "@/lib/supabase/cached";
import { runPollResults, type PollSummary } from "@/lib/poll-results";

type Result = { ok: true } | { ok: false; error: string };

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("no autorizado") || m.includes("42501")) {
    return "No tenés permisos para esto.";
  }
  if (m.includes("reason")) {
    return "Falta el motivo del cambio.";
  }
  return message;
}

/**
 * Carga el resultado de un partido. Si finalize=true, lo marca finished
 * y dispara el scoring (calculate_match) dentro de la misma RPC.
 */
export async function setMatchResult(input: {
  matchId: string;
  scoreHome: number;
  scoreAway: number;
  koWinnerTeamId: string | null;
  finalize: boolean;
  reason: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("match_set_result", {
    p_match_id: input.matchId,
    p_score_home: input.scoreHome,
    p_score_away: input.scoreAway,
    p_ko_winner_team_id: input.koWinnerTeamId as string,
    p_finalize: input.finalize,
    p_reason: input.reason.trim() || "Carga de resultado",
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/admin/results");
  revalidatePath("/leaderboard");
  revalidatePath("/mi-prode");
  revalidatePath("/matches");
  revalidateScoring();
  return { ok: true };
}

/**
 * Trae los resultados de ESPN ya mismo (mismo camino que el cron, pero
 * autorizado por ser admin en vez del secret del Vault).
 */
export async function pollEspnNow(): Promise<
  { ok: true; summary: PollSummary } | { ok: false; error: string }
> {
  const supabase = await createClient();
  try {
    const summary = await runPollResults(
      supabase as unknown as SupabaseClient,
      "",
    );
    revalidatePath("/admin/results");
    revalidatePath("/leaderboard");
    revalidatePath("/mi-prode");
    revalidatePath("/matches");
    revalidatePath("/dashboard");
    revalidateScoring();
    return { ok: true, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: friendlyError(message) };
  }
}

/** Recalcula los puntos de un partido ya finalizado (idempotente). */
export async function recalcMatch(
  matchId: string,
  reason: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recalc_match", {
    p_match_id: matchId,
    p_reason: reason.trim() || "Recálculo manual",
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/leaderboard");
  revalidatePath("/mi-prode");
  revalidateScoring();
  return { ok: true };
}
