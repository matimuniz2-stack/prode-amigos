import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import {
  fetchLiveMatch,
  findEspnEventId,
  type LiveEvent,
  type LivePlay,
} from "@/lib/espn-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MatchRow {
  id: string;
  kickoff_at: string;
  espn_event_id: string | null;
  score_home: number | null;
  score_away: number | null;
  home_team: { code: string | null; name: string | null } | null;
  away_team: { code: string | null; name: string | null } | null;
}

function sideOf(
  teamCode: string | null,
  homeCode: string | null,
  awayCode: string | null,
): "home" | "away" | null {
  if (!teamCode) return null;
  if (teamCode === homeCode) return "home";
  if (teamCode === awayCode) return "away";
  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  if (!hasSupabaseEnv()) return Response.json({ found: false }, { status: 200 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("no auth", { status: 401 });

  const { matchId } = await ctx.params;
  const { data: m } = await supabase
    .from("matches")
    .select(
      "id, kickoff_at, espn_event_id, score_home, score_away, home_team:teams!matches_home_team_id_fkey(code, name), away_team:teams!matches_away_team_id_fkey(code, name)",
    )
    .eq("id", matchId)
    .maybeSingle<MatchRow>();

  if (!m) return Response.json({ found: false }, { status: 200 });

  const homeCode = m.home_team?.code ?? null;
  const awayCode = m.away_team?.code ?? null;

  let eventId = m.espn_event_id;
  if (!eventId && homeCode && awayCode) {
    eventId = await findEspnEventId(
      homeCode,
      awayCode,
      new Date(m.kickoff_at).getTime(),
    );
  }
  if (!eventId) return Response.json({ found: false }, { status: 200 });

  const live = await fetchLiveMatch(eventId);
  if (!live) return Response.json({ found: false }, { status: 200 });

  const withSide = (e: LiveEvent) => ({
    ...e,
    side: sideOf(e.teamCode, homeCode, awayCode),
  });
  const playWithSide = (p: LivePlay) => ({
    ...p,
    side: sideOf(p.teamCode, homeCode, awayCode),
  });

  return Response.json(
    {
      found: true,
      state: live.state,
      clock: live.clock,
      home: {
        code: homeCode,
        name: m.home_team?.name ?? "Local",
        score: homeCode ? (live.scoreByCode[homeCode] ?? m.score_home ?? 0) : 0,
        stats: (homeCode && live.statsByCode[homeCode]) || null,
      },
      away: {
        code: awayCode,
        name: m.away_team?.name ?? "Visita",
        score: awayCode ? (live.scoreByCode[awayCode] ?? m.score_away ?? 0) : 0,
        stats: (awayCode && live.statsByCode[awayCode]) || null,
      },
      events: live.events.map(withSide),
      plays: live.plays.map(playWithSide),
      commentary: live.commentary,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
