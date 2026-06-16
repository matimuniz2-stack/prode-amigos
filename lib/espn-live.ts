// Detalle en vivo de un partido desde el summary no oficial de ESPN (gratis).
// El scoreboard (lib/espn.ts) da marcador/estado; esto suma estadísticas en
// vivo (posesión, tiros, córners, tarjetas), los goles con su POSICIÓN REAL en
// la cancha (fieldPositionX/Y + dónde entró en el arco) y el comentario.

const SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";
const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export interface LiveStats {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  yellow: number | null;
  red: number | null;
  saves: number | null;
}

export type LiveEventType =
  | "goal"
  | "yellow"
  | "red"
  | "sub"
  | "var"
  | "penalty"
  | "other";

export interface LiveEvent {
  minute: number;
  /** Minuto formateado por ESPN, ej. "66'". */
  clock: string;
  type: LiveEventType;
  teamCode: string | null;
  scoringPlay: boolean;
  text: string;
  shortText: string;
  player: string | null;
  /** Posición del remate en la cancha (0-100), perspectiva del equipo que ataca. */
  x: number | null;
  y: number | null;
  /** Posición horizontal en el arco donde entró (0-100). */
  goalY: number | null;
}

export interface LiveMatch {
  found: boolean;
  state: "pre" | "in" | "post";
  /** Reloj, ej. "66'" o "HT" / "FT". */
  clock: string;
  detail: string;
  scoreByCode: Record<string, number>;
  statsByCode: Record<string, LiveStats>;
  events: LiveEvent[];
  commentary: { minute: number; text: string }[];
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statValue(
  stats: Array<{ name?: string; value?: number; displayValue?: string }>,
  name: string,
): number | null {
  const s = stats.find((x) => x.name === name);
  if (!s) return null;
  return num(s.value) ?? num(s.displayValue);
}

function classifyEvent(typeType: string, typeText: string): LiveEventType {
  const t = `${typeType} ${typeText}`.toLowerCase();
  if (t.includes("goal")) return "goal";
  if (t.includes("yellow")) return "yellow";
  if (t.includes("red")) return "red";
  if (t.includes("substitution")) return "sub";
  if (t.includes("penalty")) return "penalty";
  if (t.includes("var") || t.includes("review")) return "var";
  return "other";
}

/** Busca el id de evento ESPN para un partido por códigos + fecha. */
export async function findEspnEventId(
  homeCode: string,
  awayCode: string,
  kickoffMs: number,
): Promise<string | null> {
  const ymd = (ms: number) =>
    new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
  const day = 24 * 60 * 60 * 1000;
  const res = await fetch(
    `${SCOREBOARD_URL}?dates=${ymd(kickoffMs - day)}-${ymd(kickoffMs + day)}&limit=200`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    events?: Array<{
      id?: string;
      competitions?: Array<{
        competitors?: Array<{ team?: { abbreviation?: string } }>;
      }>;
    }>;
  };
  for (const e of data.events ?? []) {
    const codes = (e.competitions?.[0]?.competitors ?? [])
      .map((c) => c.team?.abbreviation)
      .filter(Boolean);
    if (codes.includes(homeCode) && codes.includes(awayCode) && e.id) {
      return e.id;
    }
  }
  return null;
}

interface SummaryTeam {
  homeAway?: string;
  team?: { id?: string; abbreviation?: string };
  statistics?: Array<{ name?: string; value?: number; displayValue?: string }>;
}
interface SummaryKeyEvent {
  type?: { type?: string; text?: string };
  text?: string;
  shortText?: string;
  period?: { number?: number };
  clock?: { value?: number; displayValue?: string };
  scoringPlay?: boolean;
  team?: { id?: string };
  participants?: Array<{ athlete?: { displayName?: string } }>;
  fieldPositionX?: number;
  fieldPositionY?: number;
  goalPositionY?: number;
}

/** Trae y parsea el detalle en vivo de un partido por su id de ESPN. */
export async function fetchLiveMatch(eventId: string): Promise<LiveMatch | null> {
  const res = await fetch(`${SUMMARY_URL}?event=${eventId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    header?: {
      competitions?: Array<{
        status?: {
          type?: { state?: string; detail?: string; shortDetail?: string };
        };
        competitors?: Array<{
          homeAway?: string;
          score?: string | number;
          team?: { id?: string; abbreviation?: string };
        }>;
      }>;
    };
    boxscore?: { teams?: SummaryTeam[] };
    keyEvents?: SummaryKeyEvent[];
    commentary?: Array<{ time?: { displayValue?: string; value?: number }; text?: string }>;
  };

  const comp = j.header?.competitions?.[0];
  const status = comp?.status?.type;
  const state = (status?.state ?? "pre") as LiveMatch["state"];

  // Identidad de equipos: id → código.
  const codeById = new Map<string, string>();
  const scoreByCode: Record<string, number> = {};
  for (const c of comp?.competitors ?? []) {
    const code = c.team?.abbreviation;
    if (!code) continue;
    if (c.team?.id) codeById.set(c.team.id, code);
    scoreByCode[code] = num(c.score) ?? 0;
  }

  // Estadísticas por código de equipo.
  const statsByCode: Record<string, LiveStats> = {};
  for (const t of j.boxscore?.teams ?? []) {
    const code = t.team?.abbreviation;
    if (!code) continue;
    if (t.team?.id) codeById.set(t.team.id, code);
    const st = t.statistics ?? [];
    statsByCode[code] = {
      possession: statValue(st, "possessionPct"),
      shots: statValue(st, "totalShots"),
      shotsOnTarget: statValue(st, "shotsOnTarget"),
      corners: statValue(st, "wonCorners"),
      fouls: statValue(st, "foulsCommitted"),
      yellow: statValue(st, "yellowCards"),
      red: statValue(st, "redCards"),
      saves: statValue(st, "saves"),
    };
  }

  // Eventos clave (goles con posición, tarjetas, cambios…).
  const events: LiveEvent[] = [];
  for (const e of j.keyEvents ?? []) {
    const type = classifyEvent(e.type?.type ?? "", e.type?.text ?? "");
    if (type === "other") continue; // descartamos kickoff/halftime/delays
    events.push({
      minute: Math.round((e.clock?.value ?? 0) / 60),
      clock: e.clock?.displayValue ?? "",
      type,
      teamCode: e.team?.id ? (codeById.get(e.team.id) ?? null) : null,
      scoringPlay: e.scoringPlay === true,
      text: e.text ?? "",
      shortText: e.shortText ?? e.text ?? "",
      player: e.participants?.[0]?.athlete?.displayName ?? null,
      x: e.fieldPositionX ?? null,
      y: e.fieldPositionY ?? null,
      goalY: e.goalPositionY ?? null,
    });
  }

  const commentary = (j.commentary ?? [])
    .slice(-8)
    .map((c) => ({
      minute: Math.round((c.time?.value ?? 0) / 60),
      text: c.text ?? "",
    }))
    .filter((c) => c.text);

  return {
    found: true,
    state,
    clock: status?.shortDetail ?? status?.detail ?? "",
    detail: status?.detail ?? "",
    scoreByCode,
    statsByCode,
    events,
    commentary,
  };
}
