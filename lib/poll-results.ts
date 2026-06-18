// Lógica compartida del polling de resultados ESPN.
// La usan el endpoint /api/cron/poll-results (disparado por pg_cron) y el
// botón "Actualizar desde ESPN" del admin. La autorización vive en las RPCs
// (secret del Vault o is_admin()), no acá.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEspnScoreboard, type EspnEvent } from "@/lib/espn";
import { detectGoals, sendGoalPushes, type GoalCandidate } from "@/lib/push";

type Candidate = {
  id: string;
  espn_event_id: string | null;
  home_code: string;
  away_code: string;
  kickoff_at: string;
  stage_code: string;
};

type PollUpdate = {
  match_id: string;
  espn_event_id: string;
  score_home: number;
  score_away: number;
  finalize: boolean;
  ko_winner_code: string | null;
};

export type PollSummary = { live: number; updated: number; finalized: number };

const DAY_MS = 24 * 60 * 60 * 1000;
// Tolerancia entre nuestro kickoff y el de ESPN al matchear por equipos.
const KICKOFF_WINDOW_MS = 6 * 60 * 60 * 1000;

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

function findEvent(events: EspnEvent[], c: Candidate): EspnEvent | undefined {
  if (c.espn_event_id) {
    const byId = events.find((e) => e.id === c.espn_event_id);
    if (byId) return byId;
  }
  const kickoffMs = new Date(c.kickoff_at).getTime();
  return events.find((e) => {
    if (!e.homeCode || !e.awayCode) return false;
    const codes = [e.homeCode, e.awayCode];
    return (
      codes.includes(c.home_code) &&
      codes.includes(c.away_code) &&
      Math.abs(e.kickoffMs - kickoffMs) <= KICKOFF_WINDOW_MS
    );
  });
}

export async function runPollResults(
  supabase: SupabaseClient,
  secret: string,
): Promise<PollSummary> {
  const { data: candidates, error: candError } = await supabase.rpc(
    "poll_results_candidates",
    { p_secret: secret },
  );
  if (candError) throw new Error(candError.message);

  const live = (candidates ?? []) as Candidate[];
  if (live.length === 0) return { live: 0, updated: 0, finalized: 0 };

  const kickoffs = live.map((c) => new Date(c.kickoff_at).getTime());
  const events = await fetchEspnScoreboard(
    ymd(Math.min(...kickoffs) - DAY_MS),
    ymd(Math.max(...kickoffs) + DAY_MS),
  );

  const updates: PollUpdate[] = [];
  const goalCands: GoalCandidate[] = [];
  for (const c of live) {
    const ev = findEvent(events, c);
    if (!ev || ev.state === "pre") continue;
    if (ev.homeScore === null || ev.awayScore === null) continue;

    // Por si ESPN tiene invertido el local/visitante respecto a nuestro fixture.
    const swapped = ev.homeCode === c.away_code;
    const scoreHome = swapped ? ev.awayScore : ev.homeScore;
    const scoreAway = swapped ? ev.homeScore : ev.awayScore;

    goalCands.push({
      matchId: c.id,
      homeCode: c.home_code,
      awayCode: c.away_code,
      newHome: scoreHome,
      newAway: scoreAway,
    });

    let finalize = ev.state === "post" && ev.completed;
    let koWinnerCode: string | null = null;
    if (finalize && c.stage_code !== "group") {
      koWinnerCode =
        ev.winnerCode ??
        (scoreHome > scoreAway
          ? c.home_code
          : scoreAway > scoreHome
            ? c.away_code
            : null);
      // Empate sin winner marcado (penales sin data): lo cierra el admin.
      if (!koWinnerCode) finalize = false;
    }

    updates.push({
      match_id: c.id,
      espn_event_id: ev.id,
      score_home: scoreHome,
      score_away: scoreAway,
      finalize,
      ko_winner_code: koWinnerCode,
    });
  }

  if (updates.length === 0) {
    return { live: live.length, updated: 0, finalized: 0 };
  }

  // Detectar goles ANTES de aplicar (comparar el score nuevo vs el actual en
  // la DB). Best-effort: si falla o no hay service-role, seguimos normal.
  let goals: GoalCandidate[] = [];
  try {
    goals = await detectGoals(goalCands);
  } catch {
    goals = [];
  }

  const { data: applied, error: applyError } = await supabase.rpc(
    "poll_results_apply",
    { p_secret: secret, p_updates: updates },
  );
  if (applyError) throw new Error(applyError.message);

  // Avisar de los goles a los pick-holders (después de aplicar; no rompe el
  // polling si falla el envío).
  if (goals.length > 0) {
    try {
      await sendGoalPushes(goals);
    } catch {
      /* el scoring ya se aplicó; el aviso es secundario */
    }
  }

  return {
    live: live.length,
    updated: (applied as { updated?: number })?.updated ?? 0,
    finalized: (applied as { finalized?: number })?.finalized ?? 0,
  };
}
