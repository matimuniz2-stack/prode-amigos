import type { createClient } from "@/lib/supabase/server";
import { matchDayLabel, matchTimeLabel } from "@/lib/matches";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ArgentinaMatch {
  opponentName: string;
  opponentFlag: string | null;
  whenLabel: string;
  live: boolean;
  href: string;
}

interface Row {
  id: string;
  kickoff_at: string;
  status: string;
  home_team: { code: string | null; name: string | null; flag_emoji: string | null } | null;
  away_team: { code: string | null; name: string | null; flag_emoji: string | null } | null;
}

const WINDOW_BEFORE_MS = 3 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 36 * 60 * 60 * 1000;

/**
 * Devuelve el partido de Argentina si está en vivo o arranca dentro de las
 * próximas 36h (para el "modo argentino"). Null si no hay nada cerca.
 */
export async function getArgentinaMatch(
  supabase: ServerClient,
  now: number,
): Promise<ArgentinaMatch | null> {
  const { data } = await supabase
    .from("matches")
    .select(
      "id, kickoff_at, status, home_team:teams!matches_home_team_id_fkey(code, name, flag_emoji), away_team:teams!matches_away_team_id_fkey(code, name, flag_emoji)",
    )
    .gte("kickoff_at", new Date(now - WINDOW_AFTER_MS).toISOString())
    .lte("kickoff_at", new Date(now + WINDOW_AFTER_MS).toISOString())
    .order("kickoff_at", { ascending: true })
    .returns<Row[]>();

  for (const m of data ?? []) {
    const isArg =
      m.home_team?.code === "ARG" || m.away_team?.code === "ARG";
    if (!isArg || !m.home_team || !m.away_team) continue;
    if (["finished", "cancelled", "void"].includes(m.status)) continue;

    const k = new Date(m.kickoff_at).getTime();
    const live = m.status === "live" || (k <= now && k > now - WINDOW_BEFORE_MS);
    const upcoming = k > now && k - now <= WINDOW_AFTER_MS;
    if (!live && !upcoming) continue;

    const argIsHome = m.home_team.code === "ARG";
    const opp = argIsHome ? m.away_team : m.home_team;
    return {
      opponentName: opp?.name ?? "Rival",
      opponentFlag: opp?.flag_emoji ?? null,
      whenLabel: `${matchDayLabel(m.kickoff_at)} · ${matchTimeLabel(m.kickoff_at)}`,
      live,
      href: live ? "/sala-en-vivo" : `/matches/${m.id}`,
    };
  }
  return null;
}
