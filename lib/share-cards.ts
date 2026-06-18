import type { createClient } from "@/lib/supabase/server";
import { matchSelect, matchDayKey, matchDayLabel, type MatchWithRelations } from "@/lib/matches";
import { computeAdn } from "@/lib/adn";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface CardPlayer {
  rank: number;
  nickname: string;
  points: number;
  avatarUrl: string | null;
}

export interface RankingCard {
  poolLabel: string | null;
  top: CardPlayer[];
}

export interface RecapCard {
  dayLabel: string;
  nickname: string;
  avatarUrl: string | null;
  myPoints: number;
  myRank: number | null;
  myMove: number | null;
  topNicks: string[];
  topPoints: number;
  bestHit: string | null;
}

export interface FichaCard {
  nickname: string;
  avatarUrl: string | null;
  rank: number | null;
  points: number;
  traits: { emoji: string; label: string }[];
  avgGoals: number | null;
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

/** Tabla de posiciones: pozo + ranking con avatar (entran todos, hasta 16). */
export async function getRankingCard(supabase: ServerClient): Promise<RankingCard> {
  const [{ data: rows }, { data: pool }] = await Promise.all([
    supabase
      .from("leaderboard_projection")
      .select("nickname, total_points, rank, avatar_url")
      .order("rank", { ascending: true })
      .limit(16),
    supabase.from("pools").select("total_amount, currency").maybeSingle(),
  ]);

  const top: CardPlayer[] = (rows ?? []).map((r) => ({
    rank: r.rank ?? 0,
    nickname: r.nickname ?? "—",
    points: r.total_points ?? 0,
    avatarUrl: r.avatar_url ?? null,
  }));

  const amount = pool?.total_amount ?? 0;
  const poolLabel =
    amount > 0 ? money(amount, pool?.currency ?? "ARS") : null;

  return { poolLabel, top };
}

const isResolved = (status: string) =>
  status === "finished" ||
  status === "cancelled" ||
  status === "void" ||
  status === "postponed";

/** Recap personalizado de la última fecha terminada para `userId`. */
export async function getRecapCard(
  supabase: ServerClient,
  userId: string,
): Promise<RecapCard | null> {
  const { data: matches } = await supabase
    .from("matches")
    .select(matchSelect)
    .order("kickoff_at", { ascending: true })
    .returns<MatchWithRelations[]>();

  const all = matches ?? [];
  if (all.length === 0) return null;

  // Última fecha (día ART) con ≥1 partido jugado y todos resueltos.
  const byDay = new Map<string, MatchWithRelations[]>();
  for (const m of all) {
    const k = matchDayKey(m.kickoff_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(m);
  }
  let recapKey: string | null = null;
  for (const k of [...byDay.keys()].sort().reverse()) {
    const ms = byDay.get(k)!;
    const finished = ms.filter((m) => m.status === "finished").length;
    if (finished > 0 && ms.every((m) => isResolved(m.status))) {
      recapKey = k;
      break;
    }
  }
  if (!recapKey) return null;

  const dayMatches = byDay.get(recapKey)!.filter((m) => m.status === "finished");
  const matchIds = dayMatches.map((m) => m.id);
  const matchById = new Map(dayMatches.map((m) => [m.id, m]));

  const [{ data: logs }, { data: profs }, { data: proj }, { data: prof }] =
    await Promise.all([
      supabase
        .from("points_log")
        .select("user_id, points, source_id")
        .eq("source_kind", "match")
        .in("source_id", matchIds),
      supabase.from("profiles").select("id, nickname"),
      supabase
        .from("leaderboard_projection")
        .select("rank")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", userId)
        .maybeSingle<{ nickname: string; avatar_url: string | null }>(),
    ]);

  const nameById = new Map((profs ?? []).map((p) => [p.id, p.nickname ?? "—"]));

  // Mejor de la fecha (global) + mi total + mi mejor partido.
  const totalByUser = new Map<string, number>();
  let myPoints = 0;
  let bestHit: string | null = null;
  let bestHitPts = 0;
  for (const l of logs ?? []) {
    totalByUser.set(l.user_id, (totalByUser.get(l.user_id) ?? 0) + (l.points ?? 0));
    if (l.user_id === userId && (l.points ?? 0) > bestHitPts) {
      bestHitPts = l.points ?? 0;
      const m = matchById.get(l.source_id);
      if (m) {
        bestHit = `${m.home_team?.name ?? "?"} ${m.score_home}-${m.score_away} ${m.away_team?.name ?? "?"}`;
      }
    }
  }
  myPoints = totalByUser.get(userId) ?? 0;

  let topPoints = 0;
  for (const v of totalByUser.values()) if (v > topPoints) topPoints = v;
  const topNicks =
    topPoints > 0
      ? [...totalByUser.entries()]
          .filter(([, v]) => v === topPoints)
          .map(([u]) => nameById.get(u) ?? "—")
      : [];

  // Movimiento en el ranking vs la última foto guardada.
  const myRank = proj?.rank ?? null;
  let myMove: number | null = null;
  const { data: lastSnap } = await supabase
    .from("leaderboard_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastSnap?.snapshot_date && myRank !== null) {
    const { data: base } = await supabase
      .from("leaderboard_snapshots")
      .select("rank")
      .eq("snapshot_date", lastSnap.snapshot_date)
      .eq("user_id", userId)
      .maybeSingle();
    if (base?.rank != null) myMove = base.rank - myRank;
  }

  return {
    dayLabel: matchDayLabel(dayMatches[0].kickoff_at),
    nickname: prof?.nickname ?? "vos",
    avatarUrl: prof?.avatar_url ?? null,
    myPoints,
    myRank,
    myMove,
    topNicks,
    topPoints,
    bestHit: bestHitPts > 0 ? bestHit : null,
  };
}

/** Ficha / ADN de un jugador para compartir. */
export async function getFichaCard(
  supabase: ServerClient,
  userId: string,
): Promise<FichaCard | null> {
  const [{ data: prof }, { data: proj }, adn] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", userId)
      .maybeSingle<{ nickname: string; avatar_url: string | null }>(),
    supabase
      .from("leaderboard_projection")
      .select("total_points, rank")
      .eq("user_id", userId)
      .maybeSingle(),
    computeAdn(supabase, userId),
  ]);

  if (!prof) return null;

  return {
    nickname: prof.nickname ?? "—",
    avatarUrl: prof.avatar_url ?? null,
    rank: proj?.rank ?? null,
    points: proj?.total_points ?? 0,
    traits: (adn?.traits ?? []).map((t) => ({ emoji: t.emoji, label: t.label })),
    avgGoals: adn ? adn.avgGoals : null,
  };
}
