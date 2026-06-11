// Cliente del scoreboard no oficial de ESPN (gratis, sin auth).
// Las abreviaturas de ESPN coinciden 1:1 con los `teams.code` del seed
// (verificado contra los 73 eventos de la fase de grupos el 2026-06-11).

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export type EspnEvent = {
  id: string;
  kickoffMs: number;
  state: "pre" | "in" | "post";
  completed: boolean;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Código del equipo marcado winner=true (en KO incluye penales). */
  winnerCode: string | null;
};

type EspnCompetitor = {
  homeAway?: string;
  winner?: boolean;
  score?: string | number;
  team?: { abbreviation?: string };
};

type EspnRawEvent = {
  id?: string;
  date?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: Array<{ competitors?: EspnCompetitor[] }>;
};

function parseScore(value: string | number | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Trae los eventos del Mundial entre dos fechas (formato YYYYMMDD). */
export async function fetchEspnScoreboard(
  fromYmd: string,
  toYmd: string,
): Promise<EspnEvent[]> {
  const res = await fetch(
    `${SCOREBOARD_URL}?dates=${fromYmd}-${toYmd}&limit=200`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`ESPN respondió ${res.status}`);
  }
  const data = (await res.json()) as { events?: EspnRawEvent[] };

  const events: EspnEvent[] = [];
  for (const raw of data.events ?? []) {
    const competitors = raw.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const winner = competitors.find((c) => c.winner === true);
    const state = raw.status?.type?.state;
    if (!raw.id || !raw.date || !home || !away) continue;
    if (state !== "pre" && state !== "in" && state !== "post") continue;
    events.push({
      id: raw.id,
      kickoffMs: new Date(raw.date).getTime(),
      state,
      completed: raw.status?.type?.completed === true,
      homeCode: home.team?.abbreviation ?? null,
      awayCode: away.team?.abbreviation ?? null,
      homeScore: parseScore(home.score),
      awayScore: parseScore(away.score),
      winnerCode: winner?.team?.abbreviation ?? null,
    });
  }
  return events;
}
