/* ============================================================
   Insignias AUTOMÁTICAS — se calculan desde los resultados, no se
   guardan en la DB (se derivan al vuelo en cada render del ranking).
   Las subjetivas (El Maestro) las pone el admin a mano en
   profiles.tags — ver lib/tags.ts.

   Criterios:
   - 🐐 El GOAT: rank 1 del leaderboard (solo cuando ya hay puntaje).
   - 🤡 Mufa: último puesto (rank máximo, con >1 jugador y puntaje).
   - 🎯 Francotirador: el/los que más resultados EXACTOS clavaron
     (breakdown.exact_score en points_log), con al menos 1.
   - 🔥 En racha: racha actual de RACHA_MIN+ aciertos seguidos
     (picks scoreados con points>0, desde el más reciente).
   - 🧊 Pecho frío: racha actual de RACHA_MIN+ picks scoreados SIN
     pegar (points=0). Espejo inverso de "En racha".
   - 👻 El Fantasma: ≥FANTASMA_MIN partidos YA CERRADOS seguidos sin
     pick propio (auto-random o sin fila). Solo participantes.
   - 🐔 El Cagón: menor promedio de goles pronosticados (picks propios).
   - 💣 El Cebado: mayor promedio de goles pronosticados.
   - 🏅 MVP de la Fecha: mejor puntaje de la última fecha jugada.
   ============================================================ */

import type { createClient } from "@/lib/supabase/server";
import { matchDayKey } from "@/lib/matches";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const AUTO_BADGE_LABELS = {
  goat: "🐐 El GOAT",
  mufa: "🤡 Mufa",
  francotirador: "🎯 Francotirador",
  en_racha: "🔥 En racha",
  pecho_frio: "🧊 Pecho frío",
  fantasma: "👻 El Fantasma",
  cagon: "🐔 El Cagón",
  cebado: "💣 El Cebado",
  mvp_fecha: "🏅 MVP de la Fecha",
} as const;

/** Racha mínima de aciertos / no-aciertos seguidos para En racha / Pecho frío. */
export const RACHA_MIN = 3;
/** Partidos cerrados seguidos sin pick propio para El Fantasma. */
export const FANTASMA_MIN = 2;
/** Picks propios mínimos para calificar a El Cagón / El Cebado. */
export const GOLES_MIN_PICKS = 3;

/**
 * Devuelve un map userId -> etiquetas automáticas (strings con emoji,
 * listos para renderizar como chips con toneForTag).
 */
export async function computeAutoBadges(
  supabase: ServerClient,
): Promise<Map<string, string[]>> {
  const badges = new Map<string, string[]>();
  const add = (userId: string | null | undefined, label: string) => {
    if (!userId) return;
    const arr = badges.get(userId) ?? [];
    if (!arr.includes(label)) arr.push(label);
    badges.set(userId, arr);
  };

  // Ranking, points_log, picks y partidos son independientes → en paralelo.
  const [projRes, logRes, predRes, matchRes] = await Promise.all([
    supabase
      .from("leaderboard_projection")
      .select("user_id, total_points, rank")
      .returns<{ user_id: string; total_points: number; rank: number }[]>(),
    supabase
      .from("points_log")
      .select("user_id, points, breakdown, source_id")
      .eq("source_kind", "match")
      .returns<
        {
          user_id: string;
          points: number;
          breakdown: Record<string, unknown> | null;
          source_id: string;
        }[]
      >(),
    supabase
      .from("match_predictions")
      .select("user_id, match_id, predicted_home, predicted_away, is_auto_random")
      .returns<
        {
          user_id: string;
          match_id: string;
          predicted_home: number;
          predicted_away: number;
          is_auto_random: boolean;
        }[]
      >(),
    supabase
      .from("matches")
      .select("id, kickoff_at, lock_at, status")
      .returns<
        { id: string; kickoff_at: string; lock_at: string; status: string }[]
      >(),
  ]);

  const ranking = projRes.data ?? [];
  const logs = logRes.data ?? [];
  const preds = predRes.data ?? [];
  const matches = matchRes.data ?? [];
  const now = Date.now();

  const kickoffById = new Map<string, number>(
    matches.map((m) => [m.id, new Date(m.kickoff_at).getTime()]),
  );

  // 1) GOAT + Mufa desde el ranking (solo si ya hay puntaje real).
  const hasScores = ranking.some((r) => (r.total_points ?? 0) > 0);
  if (hasScores && ranking.length > 0) {
    const maxRank = Math.max(...ranking.map((r) => r.rank ?? 0));
    for (const r of ranking) {
      if ((r.rank ?? 0) === 1) add(r.user_id, AUTO_BADGE_LABELS.goat);
      else if ((r.rank ?? 0) === maxRank && maxRank > 1) {
        add(r.user_id, AUTO_BADGE_LABELS.mufa);
      }
    }
  }

  // 2) Francotirador: el/los que más exactos clavaron.
  const exactByUser = new Map<string, number>();
  for (const l of logs) {
    if (l.breakdown && "exact_score" in l.breakdown) {
      exactByUser.set(l.user_id, (exactByUser.get(l.user_id) ?? 0) + 1);
    }
  }
  const maxExact = Math.max(0, ...exactByUser.values());
  if (maxExact >= 1) {
    for (const [userId, count] of exactByUser) {
      if (count === maxExact) add(userId, AUTO_BADGE_LABELS.francotirador);
    }
  }

  // 3) En racha + Pecho frío: ordenar los picks scoreados por fecha del
  // partido (más reciente primero) y contar la racha actual.
  if (logs.length > 0) {
    const byUser = new Map<string, { t: number; points: number }[]>();
    for (const l of logs) {
      const t = kickoffById.get(l.source_id);
      if (t === undefined) continue; // pick de un partido no finalizado
      const arr = byUser.get(l.user_id) ?? [];
      arr.push({ t, points: l.points ?? 0 });
      byUser.set(l.user_id, arr);
    }
    for (const [userId, picks] of byUser) {
      picks.sort((a, b) => b.t - a.t); // más reciente primero
      let hot = 0;
      for (const p of picks) {
        if (p.points > 0) hot++;
        else break;
      }
      if (hot >= RACHA_MIN) add(userId, AUTO_BADGE_LABELS.en_racha);
      let cold = 0;
      for (const p of picks) {
        if (p.points === 0) cold++;
        else break;
      }
      if (cold >= RACHA_MIN) add(userId, AUTO_BADGE_LABELS.pecho_frio);
    }
  }

  // 4) Participantes = quien cargó al menos un pick PROPIO (no auto-random).
  const participants = new Set<string>();
  for (const p of preds) {
    if (!p.is_auto_random) participants.add(p.user_id);
  }

  // 5) El Cagón / El Cebado: promedio de goles pronosticados (picks propios).
  const goalsByUser = new Map<string, { sum: number; n: number }>();
  for (const p of preds) {
    if (p.is_auto_random) continue;
    const acc = goalsByUser.get(p.user_id) ?? { sum: 0, n: 0 };
    acc.sum += (p.predicted_home ?? 0) + (p.predicted_away ?? 0);
    acc.n += 1;
    goalsByUser.set(p.user_id, acc);
  }
  const avgEntries = [...goalsByUser.entries()]
    .filter(([, v]) => v.n >= GOLES_MIN_PICKS)
    .map(([u, v]) => ({ u, avg: v.sum / v.n }));
  if (avgEntries.length > 1) {
    const minAvg = Math.min(...avgEntries.map((e) => e.avg));
    const maxAvg = Math.max(...avgEntries.map((e) => e.avg));
    if (maxAvg > minAvg) {
      for (const e of avgEntries) {
        if (e.avg === minAvg) add(e.u, AUTO_BADGE_LABELS.cagon);
        if (e.avg === maxAvg) add(e.u, AUTO_BADGE_LABELS.cebado);
      }
    }
  }

  // 6) El Fantasma: ≥FANTASMA_MIN partidos cerrados seguidos sin pick propio.
  const closed = matches
    .filter((m) => new Date(m.lock_at).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
    );
  if (closed.length >= FANTASMA_MIN && participants.size > 0) {
    // (user, match) -> tiene pick PROPIO
    const realPick = new Set<string>();
    for (const p of preds) {
      if (!p.is_auto_random) realPick.add(`${p.user_id}|${p.match_id}`);
    }
    for (const userId of participants) {
      let run = 0;
      let ghost = false;
      for (const m of closed) {
        if (realPick.has(`${userId}|${m.id}`)) {
          run = 0;
        } else {
          run += 1;
          if (run >= FANTASMA_MIN) {
            ghost = true;
            break;
          }
        }
      }
      if (ghost) add(userId, AUTO_BADGE_LABELS.fantasma);
    }
  }

  // 7) MVP de la Fecha: mejor puntaje de la última fecha (día ART) jugada.
  const finishedByDay = new Map<string, string[]>(); // dayKey -> matchIds
  for (const m of matches) {
    if (m.status !== "finished") continue;
    const k = matchDayKey(m.kickoff_at);
    const arr = finishedByDay.get(k) ?? [];
    arr.push(m.id);
    finishedByDay.set(k, arr);
  }
  const lastDay = [...finishedByDay.keys()].sort().reverse()[0];
  if (lastDay) {
    const dayMatchIds = new Set(finishedByDay.get(lastDay)!);
    const ptsByUser = new Map<string, number>();
    for (const l of logs) {
      if (!dayMatchIds.has(l.source_id)) continue;
      ptsByUser.set(l.user_id, (ptsByUser.get(l.user_id) ?? 0) + (l.points ?? 0));
    }
    const maxPts = Math.max(0, ...ptsByUser.values());
    if (maxPts > 0) {
      for (const [userId, pts] of ptsByUser) {
        if (pts === maxPts) add(userId, AUTO_BADGE_LABELS.mvp_fecha);
      }
    }
  }

  return badges;
}
