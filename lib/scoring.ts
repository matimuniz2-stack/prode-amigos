// Espejo en JS del scoring de calculate_match (supabase/migrations/..._rpcs.sql).
// Se usa SOLO para la proyeccion en vivo ("si termina asi sumás +X"). La
// fuente de verdad para los puntos reales sigue siendo el RPC en la DB; esto
// es una estimacion sobre el marcador actual.

export interface ScoringRule {
  rule_key: string;
  scope_stage: string | null;
  points: number;
}

export interface PredictionInput {
  predicted_winner: string | null;
  predicted_home: number | null;
  predicted_away: number | null;
}

/** Puntos de una regla para un stage: prioriza scope exacto sobre '*'. */
function ruleFor(
  rules: ScoringRule[],
  key: string,
  stageCode: string,
): number {
  let best: number | null = null;
  let bestPref = 99;
  for (const r of rules) {
    if (r.rule_key !== key) continue;
    if (r.scope_stage === stageCode || r.scope_stage === "*") {
      const pref = r.scope_stage === stageCode ? 0 : 1;
      if (pref < bestPref) {
        bestPref = pref;
        best = r.points;
      }
    }
  }
  return best ?? 0;
}

function goalDiffRule(rules: ScoringRule[]): number {
  const r = rules.find((x) => x.rule_key === "goal_diff_correct");
  return r?.points ?? 0;
}

export interface ScoreResult {
  points: number;
  winner: boolean;
  exact: boolean;
}

/**
 * Cuántos puntos sacaría `pred` si el partido terminara `scoreHome-scoreAway`.
 * Misma lógica que el RPC: acierto de 1X2 + bonus exacto (o diferencia de gol).
 */
export function scorePrediction(
  pred: PredictionInput,
  scoreHome: number,
  scoreAway: number,
  stageCode: string,
  rules: ScoringRule[],
): ScoreResult {
  const liveWinner =
    scoreHome > scoreAway ? "home" : scoreHome < scoreAway ? "away" : "draw";

  if (pred.predicted_winner !== liveWinner) {
    return { points: 0, winner: false, exact: false };
  }

  let points = ruleFor(rules, "winner_correct", stageCode);

  if (pred.predicted_home === scoreHome && pred.predicted_away === scoreAway) {
    return {
      points: points + ruleFor(rules, "exact_score", stageCode),
      winner: true,
      exact: true,
    };
  }

  if (
    pred.predicted_home != null &&
    pred.predicted_away != null &&
    pred.predicted_home - pred.predicted_away === scoreHome - scoreAway
  ) {
    points += goalDiffRule(rules);
  }

  return { points, winner: true, exact: false };
}
