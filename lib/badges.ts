/* ============================================================
   Insignias AUTOMÁTICAS — se calculan desde los resultados, no se
   guardan en la DB (se derivan al vuelo en cada render del ranking).
   Las subjetivas (El Maestro, Pecho frío) las pone el admin a mano
   en profiles.tags — ver lib/tags.ts.

   Criterios:
   - 🐐 El GOAT: rank 1 del leaderboard (solo cuando ya hay puntaje).
   - 🤡 Mufa: último puesto (rank máximo, con >1 jugador y puntaje).
   - 🎯 Francotirador: el/los que más resultados EXACTOS clavaron
     (breakdown.exact_score en points_log), con al menos 1.
   - 🔥 En racha: racha actual de RACHA_MIN+ aciertos seguidos
     (picks scoreados con points>0, contando desde el partido más
     reciente hacia atrás, ordenado por kickoff).
   ============================================================ */

import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const AUTO_BADGE_LABELS = {
  goat: "🐐 El GOAT",
  mufa: "🤡 Mufa",
  francotirador: "🎯 Francotirador",
  en_racha: "🔥 En racha",
} as const;

/** Racha mínima de aciertos seguidos para "En racha". */
export const RACHA_MIN = 3;

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

  // 1) GOAT + Mufa desde el ranking (solo si ya hay puntaje real).
  const { data: proj } = await supabase
    .from("leaderboard_projection")
    .select("user_id, total_points, rank")
    .returns<{ user_id: string; total_points: number; rank: number }[]>();
  const ranking = proj ?? [];
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

  // 2) points_log de partidos: para Francotirador y En racha.
  const { data: logRows } = await supabase
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
    >();
  const logs = logRows ?? [];

  // Francotirador: el/los que más exactos clavaron.
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

  // En racha: necesito ordenar los picks de cada usuario por fecha del
  // partido. points_log.source_id = match id (sin FK embebible) → traigo
  // el kickoff de los partidos finalizados y armo el orden a mano.
  if (logs.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, kickoff_at")
      .eq("status", "finished")
      .returns<{ id: string; kickoff_at: string }[]>();
    const kickoffById = new Map<string, number>(
      (matchRows ?? []).map((m) => [m.id, new Date(m.kickoff_at).getTime()]),
    );

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
      let streak = 0;
      for (const p of picks) {
        if (p.points > 0) streak++;
        else break;
      }
      if (streak >= RACHA_MIN) add(userId, AUTO_BADGE_LABELS.en_racha);
    }
  }

  return badges;
}
