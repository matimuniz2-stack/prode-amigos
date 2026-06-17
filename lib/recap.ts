import type { createClient } from "@/lib/supabase/server";
import {
  matchDayKey,
  matchDayLabel,
  type MatchWithRelations,
} from "@/lib/matches";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RecapExacto {
  nickname: string;
  matchLabel: string;
  score: string;
}

export interface Recap {
  dayLabel: string;
  /** Nicknames que lideraron la fecha (puede haber empate). */
  topNicks: string[];
  topPoints: number;
  /** Clavadas de resultado exacto. */
  exactos: RecapExacto[];
  /** Partidos donde nadie acertó ni el 1X2 (etiqueta con marcador). */
  plenos: string[];
  /** El/los que menos sumaron la fecha (mufa), solo si hubo diferencia. */
  bottomNicks: string[];
  bottomPoints: number;
  /** Goles totales de la fecha. */
  totalGoals: number;
  /** La goleada de la fecha (diferencia ≥3), si hubo. */
  goleada: string | null;
}

const isResolved = (status: string) =>
  status === "finished" ||
  status === "cancelled" ||
  status === "void" ||
  status === "postponed";

/**
 * Resumen de la última fecha (día ART) totalmente terminada: mejor de la
 * fecha, clavadas y partidos que nadie acertó. Devuelve null si todavía no
 * hay ninguna jornada cerrada. Se calcula sobre points_log (fuente real).
 */
export async function computeRecap(
  supabase: ServerClient,
  matches: MatchWithRelations[],
): Promise<Recap | null> {
  // 1. Agrupar por día ART.
  const byDay = new Map<string, MatchWithRelations[]>();
  for (const m of matches) {
    const k = matchDayKey(m.kickoff_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(m);
  }

  // 2. Último día con ≥1 partido jugado y todos resueltos.
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

  // 3. Puntos reales del día + nombres.
  const [{ data: logs }, { data: profs }] = await Promise.all([
    supabase
      .from("points_log")
      .select("user_id, points, breakdown, source_id")
      .eq("source_kind", "match")
      .in("source_id", matchIds),
    supabase.from("profiles").select("id, nickname"),
  ]);
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, p.nickname ?? "—"]),
  );

  // Total por jugador en la fecha → mejor(es) de la fecha.
  const totalByUser = new Map<string, number>();
  for (const l of logs ?? []) {
    totalByUser.set(
      l.user_id,
      (totalByUser.get(l.user_id) ?? 0) + (l.points ?? 0),
    );
  }
  let topPoints = 0;
  for (const v of totalByUser.values()) if (v > topPoints) topPoints = v;
  const topNicks =
    topPoints > 0
      ? [...totalByUser.entries()]
          .filter(([, v]) => v === topPoints)
          .map(([u]) => nameById.get(u) ?? "—")
      : [];

  const labelOf = (id: string) => {
    const m = matchById.get(id);
    return `${m?.home_team?.name ?? "?"}-${m?.away_team?.name ?? "?"}`;
  };

  // Clavadas (exact_score en el breakdown) y plenos (nadie acertó el 1X2).
  const exactos: RecapExacto[] = [];
  const matchHadWinner = new Set<string>();
  for (const l of logs ?? []) {
    const bd = (l.breakdown ?? {}) as Record<string, number>;
    if ((bd.winner_correct ?? 0) > 0) matchHadWinner.add(l.source_id);
    if ((bd.exact_score ?? 0) > 0) {
      const m = matchById.get(l.source_id);
      exactos.push({
        nickname: nameById.get(l.user_id) ?? "—",
        matchLabel: labelOf(l.source_id),
        score: `${m?.score_home}-${m?.score_away}`,
      });
    }
  }

  const plenos = dayMatches
    .filter((m) => !matchHadWinner.has(m.id))
    .map(
      (m) =>
        `${m.home_team?.name ?? "?"} ${m.score_home}-${m.score_away} ${m.away_team?.name ?? "?"}`,
    );

  // La mufa: el/los que menos sumaron (solo con ≥3 jugadores y diferencia real).
  let bottomPoints = 0;
  let bottomNicks: string[] = [];
  if (totalByUser.size >= 3) {
    bottomPoints = Math.min(...totalByUser.values());
    if (bottomPoints < topPoints) {
      bottomNicks = [...totalByUser.entries()]
        .filter(([, v]) => v === bottomPoints)
        .map(([u]) => nameById.get(u) ?? "—");
    }
  }

  // Dato de color: goles totales y la goleada (diferencia ≥3) de la fecha.
  let totalGoals = 0;
  let goleada: string | null = null;
  let goleadaDiff = 0;
  for (const m of dayMatches) {
    const gh = m.score_home ?? 0;
    const ga = m.score_away ?? 0;
    totalGoals += gh + ga;
    const diff = Math.abs(gh - ga);
    if (diff >= 3 && diff > goleadaDiff) {
      goleadaDiff = diff;
      goleada = `${m.home_team?.name ?? "?"} ${gh}-${ga} ${m.away_team?.name ?? "?"}`;
    }
  }

  return {
    dayLabel: matchDayLabel(dayMatches[0].kickoff_at),
    topNicks,
    topPoints,
    exactos,
    plenos,
    bottomNicks,
    bottomPoints,
    totalGoals,
    goleada,
  };
}
