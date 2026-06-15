/* Mapa código de equipo → continente/confederación. No hay columna en la DB
   (teams solo tiene group + seed_pot), así que se mantiene acá a mano. Cubre
   los 48 equipos del Mundial 2026 seedeados. Se usa en el "ADN Futbolero". */

export type Continente =
  | "Sudamérica"
  | "Europa"
  | "África"
  | "Asia"
  | "Concacaf"
  | "Oceanía";

export const CONTINENT_BY_CODE: Record<string, Continente> = {
  // CONMEBOL
  BRA: "Sudamérica", ARG: "Sudamérica", URU: "Sudamérica", PAR: "Sudamérica",
  ECU: "Sudamérica", COL: "Sudamérica",
  // UEFA
  CZE: "Europa", SUI: "Europa", BIH: "Europa", SCO: "Europa", TUR: "Europa",
  GER: "Europa", NED: "Europa", SWE: "Europa", BEL: "Europa", ESP: "Europa",
  FRA: "Europa", NOR: "Europa", AUT: "Europa", POR: "Europa", ENG: "Europa",
  CRO: "Europa",
  // CAF
  RSA: "África", MAR: "África", CIV: "África", TUN: "África", EGY: "África",
  CPV: "África", SEN: "África", ALG: "África", COD: "África", GHA: "África",
  // AFC
  KOR: "Asia", QAT: "Asia", AUS: "Asia", JPN: "Asia", IRN: "Asia",
  KSA: "Asia", IRQ: "Asia", JOR: "Asia", UZB: "Asia",
  // CONCACAF
  MEX: "Concacaf", CAN: "Concacaf", HAI: "Concacaf", USA: "Concacaf",
  CUW: "Concacaf", PAN: "Concacaf",
  // OFC
  NZL: "Oceanía",
};

export const CONTINENT_EMOJI: Record<Continente, string> = {
  "Sudamérica": "🌎",
  "Europa": "🇪🇺",
  "África": "🌍",
  "Asia": "🌏",
  "Concacaf": "🌎",
  "Oceanía": "🏝️",
};

export function continentForCode(code: string | null | undefined): Continente | null {
  if (!code) return null;
  return CONTINENT_BY_CODE[code] ?? null;
}
