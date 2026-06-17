import type { Database } from "@/lib/types/database";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type StageRow = Database["public"]["Tables"]["stages"]["Row"];
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type PredictionRow = Database["public"]["Tables"]["match_predictions"]["Row"];

export type MatchWithRelations = MatchRow & {
  home_team: Pick<TeamRow, "id" | "code" | "name" | "flag_emoji"> | null;
  away_team: Pick<TeamRow, "id" | "code" | "name" | "flag_emoji"> | null;
  stage: Pick<StageRow, "code" | "name" | "scoring_profile"> | null;
  group: Pick<GroupRow, "code"> | null;
};

export type MatchWithPick = MatchWithRelations & {
  user_pick: Pick<
    PredictionRow,
    | "id"
    | "predicted_winner"
    | "predicted_home"
    | "predicted_away"
    | "predicted_ko_winner_team_id"
    | "is_auto_random"
    | "state"
  > | null;
  /** Puntos que el usuario sacó en este partido (points_log), null si no puntuó aún. */
  user_points: number | null;
};

const MATCH_RELATIONS_SELECT = `
  *,
  home_team:teams!matches_home_team_id_fkey(id, code, name, flag_emoji),
  away_team:teams!matches_away_team_id_fkey(id, code, name, flag_emoji),
  stage:stages(code, name, scoring_profile),
  group:groups(code)
`;

export const matchSelect = MATCH_RELATIONS_SELECT;

const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARG_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayLabelFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARG_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARG_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function matchDayKey(kickoff: string): string {
  return dayKeyFormatter.format(new Date(kickoff));
}

export function matchDayLabel(kickoff: string): string {
  const label = dayLabelFormatter.format(new Date(kickoff));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function matchTimeLabel(kickoff: string): string {
  return timeFormatter.format(new Date(kickoff));
}

/** Etiqueta del día de hoy (ART), capitalizada. Para el encabezado del Diario. */
export function todayLabelAR(now: Date = new Date()): string {
  const label = dayLabelFormatter.format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "hoy" / "mañana" / "Sábado, 14 de junio" según el día ART del kickoff. */
export function relativeDayLabel(kickoff: string, now: Date = new Date()): string {
  const k = matchDayKey(kickoff);
  if (k === dayKeyFormatter.format(now)) return "hoy";
  if (k === dayKeyFormatter.format(new Date(now.getTime() + 86_400_000))) {
    return "mañana";
  }
  return matchDayLabel(kickoff);
}

export function groupMatchesByDay<T extends { kickoff_at: string }>(matches: T[]) {
  const map = new Map<string, { dayKey: string; dayLabel: string; matches: T[] }>();
  for (const m of matches) {
    const dayKey = matchDayKey(m.kickoff_at);
    if (!map.has(dayKey)) {
      map.set(dayKey, {
        dayKey,
        dayLabel: matchDayLabel(m.kickoff_at),
        matches: [],
      });
    }
    map.get(dayKey)!.matches.push(m);
  }
  return Array.from(map.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export type MatchDisplayStatus =
  | "pending_bracket"
  | "upcoming"
  | "locking_soon"
  | "live"
  | "finished"
  | "void";

export function displayStatus(match: MatchRow, now: number = Date.now()): MatchDisplayStatus {
  if (match.status === "pending_bracket") return "pending_bracket";
  if (match.status === "finished") return "finished";
  if (match.status === "cancelled" || match.status === "void") return "void";
  if (match.status === "live") return "live";
  const kickoffMs = new Date(match.kickoff_at).getTime();
  if (kickoffMs <= now) return "live";
  if (kickoffMs - now < 60 * 60 * 1000) return "locking_soon";
  return "upcoming";
}

export const stageLabels: Record<string, string> = {
  group: "Fase de grupos",
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinales",
  tp: "Tercer puesto",
  final: "Final",
};
