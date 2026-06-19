import { unstable_cache } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import { matchDayKey, matchDayLabel } from "@/lib/matches";
import { cachedReadClient, SCORING_TAG } from "@/lib/supabase/cached";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface CareerSeries {
  userId: string;
  nickname: string;
  /** Puntos ACUMULADOS al cierre de cada fecha (alineado con `days`). */
  cumulative: number[];
  total: number;
}

export interface Career {
  days: { key: string; label: string }[];
  series: CareerSeries[];
}

/**
 * Gráfico de la carrera: puntos acumulados por fecha (día ART) de cada
 * jugador. Solo cuenta partidos finalizados (puntos reales de points_log).
 * Devuelve null si todavía no hay ninguna fecha jugada.
 */
export async function computeCareer(
  supabase: ServerClient,
): Promise<Career | null> {
  const [{ data: logs }, { data: matches }, { data: profs }] = await Promise.all([
    supabase
      .from("points_log")
      .select("user_id, points, source_id")
      .eq("source_kind", "match")
      .returns<{ user_id: string; points: number; source_id: string }[]>(),
    supabase
      .from("matches")
      .select("id, kickoff_at, status")
      .eq("status", "finished")
      .returns<{ id: string; kickoff_at: string; status: string }[]>(),
    supabase
      .from("profiles")
      .select("id, nickname")
      .returns<{ id: string; nickname: string }[]>(),
  ]);

  const finished = matches ?? [];
  if (finished.length === 0) return null;

  // Día (key + label) por match, y orden de fechas.
  const dayKeyByMatch = new Map<string, string>();
  const labelByKey = new Map<string, string>();
  for (const m of finished) {
    const k = matchDayKey(m.kickoff_at);
    dayKeyByMatch.set(m.id, k);
    if (!labelByKey.has(k)) labelByKey.set(k, matchDayLabel(m.kickoff_at));
  }
  const dayKeys = [...labelByKey.keys()].sort();
  const dayIndex = new Map(dayKeys.map((k, i) => [k, i]));

  // Puntos por (usuario, fecha).
  const perUserDay = new Map<string, number[]>(); // userId -> [porFecha]
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.nickname ?? "—"]));
  for (const l of logs ?? []) {
    const k = dayKeyByMatch.get(l.source_id);
    if (k === undefined) continue;
    const di = dayIndex.get(k)!;
    const arr = perUserDay.get(l.user_id) ?? new Array(dayKeys.length).fill(0);
    arr[di] += l.points ?? 0;
    perUserDay.set(l.user_id, arr);
  }

  const series: CareerSeries[] = [];
  for (const [userId, byDay] of perUserDay) {
    const cumulative: number[] = [];
    let acc = 0;
    for (const d of byDay) {
      acc += d;
      cumulative.push(acc);
    }
    series.push({
      userId,
      nickname: nameById.get(userId) ?? "—",
      cumulative,
      total: acc,
    });
  }
  series.sort((a, b) => b.total - a.total);

  return {
    days: dayKeys.map((k) => ({ key: k, label: labelByKey.get(k)! })),
    series,
  };
}

/**
 * Versión cacheada de computeCareer: el gráfico es igual para todos, así que se
 * calcula una vez y se reusa hasta que cambian resultados (revalidateScoring) o
 * pasan 60s. Si no hay service-role, cae al cómputo normal por-request.
 */
const cachedCareer = unstable_cache(
  async (): Promise<Career | null> => {
    const admin = cachedReadClient();
    if (!admin) return null;
    return computeCareer(admin);
  },
  ["career-v1"],
  { tags: [SCORING_TAG], revalidate: 60 },
);

export async function getCareer(
  supabase: ServerClient,
): Promise<Career | null> {
  if (!cachedReadClient()) return computeCareer(supabase);
  return cachedCareer();
}
