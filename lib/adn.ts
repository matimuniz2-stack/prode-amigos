import type { createClient } from "@/lib/supabase/server";
import { continentForCode, CONTINENT_EMOJI, type Continente } from "@/lib/confederations";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AdnTrait {
  emoji: string;
  label: string;
  detail: string;
}

export interface Adn {
  totalPicks: number;
  avgGoals: number;
  drawPct: number;
  underdogPct: number;
  favContinent: Continente | null;
  traits: AdnTrait[];
}

interface TeamMini {
  code: string | null;
  seed_pot: number | null;
}
interface PredRow {
  predicted_winner: string | null;
  predicted_home: number | null;
  predicted_away: number | null;
  match: {
    kickoff_at: string | null;
    status: string | null;
    home_team: TeamMini | null;
    away_team: TeamMini | null;
  } | null;
}

/**
 * "ADN Futbolero": rasgos de un jugador derivados de SUS picks propios
 * (no auto-random). Promedio de goles, % de empates, continente que más
 * banca y cuánto le tira al underdog (equipo de peor pot).
 */
export async function computeAdn(
  supabase: ServerClient,
  userId: string,
): Promise<Adn | null> {
  const { data } = await supabase
    .from("match_predictions")
    .select(
      "predicted_winner, predicted_home, predicted_away, match:matches(kickoff_at, status, home_team:teams!matches_home_team_id_fkey(code, seed_pot), away_team:teams!matches_away_team_id_fkey(code, seed_pot))",
    )
    .eq("user_id", userId)
    .eq("is_auto_random", false)
    .returns<PredRow[]>();

  // Solo contamos picks de partidos que YA arrancaron: así el ADN refleja
  // lo que realmente pasó y no spoilea las predicciones futuras del jugador
  // (que recién se hacen públicas cuando el partido se cierra/arranca).
  const now = Date.now();
  const picks = (data ?? []).filter((p) => {
    const m = p.match;
    if (!m) return false;
    if (m.status === "finished" || m.status === "live") return true;
    if (m.status === "cancelled" || m.status === "void") return false;
    return m.kickoff_at != null && new Date(m.kickoff_at).getTime() <= now;
  });
  if (picks.length === 0) return null;

  let goalSum = 0;
  let draws = 0;
  let nonDraw = 0;
  let underdog = 0;
  const continentCount = new Map<Continente, number>();

  for (const p of picks) {
    goalSum += (p.predicted_home ?? 0) + (p.predicted_away ?? 0);
    const home = p.match?.home_team ?? null;
    const away = p.match?.away_team ?? null;

    if (p.predicted_winner === "draw") {
      draws++;
      continue;
    }
    nonDraw++;
    const winner = p.predicted_winner === "home" ? home : away;
    const loser = p.predicted_winner === "home" ? away : home;

    const cont = continentForCode(winner?.code);
    if (cont) continentCount.set(cont, (continentCount.get(cont) ?? 0) + 1);

    // Underdog = el ganador elegido tiene peor pot (número más alto) que el rival.
    if (
      winner?.seed_pot != null &&
      loser?.seed_pot != null &&
      winner.seed_pot > loser.seed_pot
    ) {
      underdog++;
    }
  }

  const totalPicks = picks.length;
  const avgGoals = goalSum / totalPicks;
  const drawPct = draws / totalPicks;
  const underdogPct = nonDraw > 0 ? underdog / nonDraw : 0;

  let favContinent: Continente | null = null;
  let favCount = 0;
  for (const [c, n] of continentCount) {
    if (n > favCount) {
      favCount = n;
      favContinent = c;
    }
  }

  // Rasgos en texto.
  const traits: AdnTrait[] = [];
  if (avgGoals >= 3) {
    traits.push({ emoji: "💣", label: "Cebado", detail: `mete ${avgGoals.toFixed(1)} goles de promedio por partido` });
  } else if (avgGoals <= 1.5) {
    traits.push({ emoji: "🐔", label: "Cagón", detail: `apenas ${avgGoals.toFixed(1)} goles de promedio, todo 1-0` });
  } else {
    traits.push({ emoji: "⚖️", label: "Equilibrado", detail: `${avgGoals.toFixed(1)} goles de promedio` });
  }
  if (drawPct >= 0.3) {
    traits.push({ emoji: "🤝", label: "Resguardado", detail: `${Math.round(drawPct * 100)}% de sus picks son empate` });
  }
  if (favContinent && favCount >= 2) {
    traits.push({
      emoji: CONTINENT_EMOJI[favContinent],
      label: `Fan de ${favContinent}`,
      detail: `${favCount} veces le dio el triunfo a equipos de ${favContinent}`,
    });
  }
  if (underdogPct >= 0.4 && nonDraw >= 3) {
    traits.push({ emoji: "🐶", label: "Amante del underdog", detail: `${Math.round(underdogPct * 100)}% de las veces banca al de peor pot` });
  } else if (underdogPct <= 0.1 && nonDraw >= 3) {
    traits.push({ emoji: "👑", label: "Va a lo seguro", detail: "casi siempre le da el triunfo al favorito" });
  }

  return { totalPicks, avgGoals, drawPct, underdogPct, favContinent, traits };
}
