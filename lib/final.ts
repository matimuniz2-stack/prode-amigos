/* ============================================================
   El Gran Final — data del cierre del Mundial para /final:
   podio definitivo, pozo repartido y los Premios del Prode
   (honoríficos auto-computados de la data del torneo).
   Todo se deriva al vuelo, no se guarda nada en la DB.
   ============================================================ */

import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface FinalPlayer {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  points: number;
  rank: number;
  prize: number;
}

export interface Premio {
  emoji: string;
  title: string;
  desc: string;
  winners: { nickname: string; avatarUrl: string | null }[];
  stat: string;
}

export interface FinalData {
  /** true recién cuando la final está finished. */
  done: boolean;
  /** "España 1 - 0 Argentina" */
  finalScore: string | null;
  standings: FinalPlayer[];
  podium: FinalPlayer[];
  champion: FinalPlayer | null;
  last: FinalPlayer | null;
  poolTotal: number;
  currency: string;
  /** Resultados exactos que clavó el campeón (para la foto). */
  championExactos: number;
  premios: Premio[];
}

interface Profilish {
  nickname: string;
  avatarUrl: string | null;
}

/** Gana el/los que tengan el máximo (si es > que `min`). */
function topOf(
  counts: Map<string, number>,
  byId: Map<string, Profilish>,
  min = 0,
): { winners: Profilish[]; value: number } {
  let max = min;
  for (const v of counts.values()) if (v > max) max = v;
  if (max <= min) return { winners: [], value: 0 };
  const winners: Profilish[] = [];
  for (const [id, v] of counts) {
    const p = byId.get(id);
    if (v === max && p) winners.push(p);
  }
  return { winners, value: max };
}

export async function getFinalData(supabase: ServerClient): Promise<FinalData> {
  const [
    { data: proj },
    { data: pool },
    { data: finalMatch },
    { data: matchLogs },
    { data: globalLogs },
    { data: preds },
    { data: chat },
    { data: declas },
    { data: matches },
  ] = await Promise.all([
    supabase
      .from("leaderboard_projection")
      .select(
        "user_id, nickname, total_points, rank, projected_prize, pool_total, currency, avatar_url",
      )
      .order("rank", { ascending: true }),
    supabase.from("pools").select("total_amount, currency").maybeSingle(),
    // La final es el partido de match_number más alto (104 en este Mundial).
    supabase
      .from("matches")
      .select(
        "status, score_home, score_away, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), stage:stages(code)",
      )
      .order("match_number", { ascending: false })
      .limit(1)
      .maybeSingle<{
        status: string;
        score_home: number | null;
        score_away: number | null;
        home_team: { name: string } | null;
        away_team: { name: string } | null;
        stage: { code: string } | null;
      }>(),
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
      .from("points_log")
      .select("user_id, points")
      .eq("source_kind", "global")
      .returns<{ user_id: string; points: number }[]>(),
    supabase
      .from("match_predictions")
      .select("user_id, is_auto_random")
      .returns<{ user_id: string; is_auto_random: boolean }[]>(),
    supabase
      .from("match_chat_messages")
      .select("user_id")
      .returns<{ user_id: string }[]>(),
    supabase
      .from("declarations")
      .select("user_id")
      .returns<{ user_id: string }[]>(),
    supabase
      .from("matches")
      .select("id, kickoff_at, status")
      .eq("status", "finished")
      .returns<{ id: string; kickoff_at: string; status: string }[]>(),
  ]);

  const standings: FinalPlayer[] = (proj ?? []).map((r) => ({
    userId: r.user_id ?? "",
    nickname: r.nickname ?? "—",
    points: r.total_points ?? 0,
    rank: r.rank ?? 0,
    prize: r.projected_prize ?? 0,
    avatarUrl: r.avatar_url ?? null,
  }));

  const done =
    finalMatch?.status === "finished" && finalMatch.stage?.code === "final";
  const finalScore =
    done && finalMatch
      ? `${finalMatch.home_team?.name ?? "?"} ${finalMatch.score_home} - ${finalMatch.score_away} ${finalMatch.away_team?.name ?? "?"}`
      : null;

  const champion = standings[0] ?? null;
  const last = standings.length > 1 ? standings[standings.length - 1] : null;

  const byId = new Map<string, Profilish>(
    standings.map((s) => [
      s.userId,
      { nickname: s.nickname, avatarUrl: s.avatarUrl },
    ]),
  );

  // --- Stats para los premios ---------------------------------------------

  // Exactos por jugador (breakdown.exact_score, igual que el Francotirador).
  const exactos = new Map<string, number>();
  for (const l of matchLogs ?? []) {
    if (l.breakdown && "exact_score" in l.breakdown) {
      exactos.set(l.user_id, (exactos.get(l.user_id) ?? 0) + 1);
    }
  }

  // Puntos de globales por jugador.
  const globales = new Map<string, number>();
  for (const l of globalLogs ?? []) {
    globales.set(l.user_id, (globales.get(l.user_id) ?? 0) + (l.points ?? 0));
  }

  // Mensajes del chat y conferencias de prensa.
  const mensajes = new Map<string, number>();
  for (const m of chat ?? []) {
    mensajes.set(m.user_id, (mensajes.get(m.user_id) ?? 0) + 1);
  }
  const conferencias = new Map<string, number>();
  for (const d of declas ?? []) {
    conferencias.set(d.user_id, (conferencias.get(d.user_id) ?? 0) + 1);
  }

  // Picks a la marchanta (auto-random).
  const randoms = new Map<string, number>();
  for (const p of preds ?? []) {
    if (p.is_auto_random) {
      randoms.set(p.user_id, (randoms.get(p.user_id) ?? 0) + 1);
    }
  }

  // Rachas: mejor seguidilla con puntos y peor sequía sin puntos, sobre los
  // partidos finalizados en orden cronológico.
  const kickoffById = new Map(
    (matches ?? []).map((m) => [m.id, new Date(m.kickoff_at).getTime()]),
  );
  const picksByUser = new Map<string, { t: number; points: number }[]>();
  for (const l of matchLogs ?? []) {
    const t = kickoffById.get(l.source_id);
    if (t === undefined) continue;
    const arr = picksByUser.get(l.user_id) ?? [];
    arr.push({ t, points: l.points ?? 0 });
    picksByUser.set(l.user_id, arr);
  }
  const mejorRacha = new Map<string, number>();
  const peorSequia = new Map<string, number>();
  for (const [userId, picks] of picksByUser) {
    picks.sort((a, b) => a.t - b.t);
    let hot = 0;
    let cold = 0;
    let bestHot = 0;
    let bestCold = 0;
    for (const p of picks) {
      if (p.points > 0) {
        hot += 1;
        cold = 0;
      } else {
        cold += 1;
        hot = 0;
      }
      if (hot > bestHot) bestHot = hot;
      if (cold > bestCold) bestCold = cold;
    }
    mejorRacha.set(userId, bestHot);
    peorSequia.set(userId, bestCold);
  }

  // --- Los Premios del Prode ----------------------------------------------

  const premios: Premio[] = [];
  const push = (
    emoji: string,
    title: string,
    desc: string,
    counts: Map<string, number>,
    stat: (v: number) => string,
  ) => {
    const { winners, value } = topOf(counts, byId);
    if (winners.length > 0) {
      premios.push({ emoji, title, desc, winners, stat: stat(value) });
    }
  };

  push(
    "🔮",
    "El Profeta",
    "El que mejor vio el futuro en las globales",
    globales,
    (v) => `${v} pts en globales`,
  );
  push(
    "🎯",
    "El Francotirador",
    "El que más resultados exactos clavó",
    exactos,
    (v) => `${v} resultados exactos`,
  );
  push(
    "🔥",
    "La Racha del Mundial",
    "La mejor seguidilla de partidos sumando",
    mejorRacha,
    (v) => `${v} partidos seguidos sumando`,
  );
  push(
    "🌵",
    "La Sequía",
    "La peor seguidilla sin embocar una",
    peorSequia,
    (v) => `${v} partidos seguidos en cero`,
  );
  push(
    "🌶️",
    "El Picante del Chat",
    "El que más habló mientras rodaba la pelota",
    mensajes,
    (v) => `${v} mensajes en los partidos`,
  );
  push(
    "🎙️",
    "El Conferencista",
    "El que más veces se sentó frente a los micrófonos",
    conferencias,
    (v) => `${v} conferencias de prensa`,
  );
  push(
    "🐌",
    "El Amarrete",
    "El que más picks dejó librados al azar",
    randoms,
    (v) => `${v} picks a la marchanta`,
  );

  return {
    done,
    finalScore,
    standings,
    podium: standings.slice(0, 3),
    champion,
    last,
    poolTotal: pool?.total_amount ?? (proj?.[0]?.pool_total ?? 0),
    currency: pool?.currency ?? proj?.[0]?.currency ?? "ARS",
    championExactos: champion ? (exactos.get(champion.userId) ?? 0) : 0,
    premios,
  };
}
