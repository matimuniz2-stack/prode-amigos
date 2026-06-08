# -*- coding: utf-8 -*-
"""Generador one-shot: fechas REALES del Mundial 2026 (FIFA oficial).

Mapea cada match_number a su kickoff real en UTC. Fuente:
  - Fase de grupos: ESPN (horarios en ET -> UTC = ET + 4, EDT en junio).
  - KO (73-104): Wikipedia "2026 FIFA World Cup knockout stage"
    (la numeracion del bracket de la migracion 0018 == numeracion oficial FIFA).

Mapeo de grupos POR PAR DE EQUIPOS (el orden round-robin del seed era
sintetico y no coincidia con el calendario real).

Produce:
  - supabase/migrations/20260607093000_fix_real_match_dates.sql  (UPDATE prod)
  - reescribe supabase/seed/03_matches_groups.sql y 04_matches_ko.sql
    (lock_at = kickoff_at, convencion original del seed).
"""
from __future__ import annotations
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TID = "00000000-0000-0000-0000-00000000a001"

# match_number -> kickoff UTC (ISO, sufijo Z)
KICK = {
    # Grupo A
    1: "2026-06-11T19:00:00Z",  # MEX-RSA
    2: "2026-06-12T02:00:00Z",  # KOR-CZE
    3: "2026-06-19T03:00:00Z",  # MEX-KOR
    4: "2026-06-18T16:00:00Z",  # CZE-RSA
    5: "2026-06-25T01:00:00Z",  # CZE-MEX
    6: "2026-06-25T01:00:00Z",  # RSA-KOR
    # Grupo B
    7: "2026-06-18T22:00:00Z",  # CAN-QAT
    8: "2026-06-18T19:00:00Z",  # SUI-BIH
    9: "2026-06-24T19:00:00Z",  # CAN-SUI
    10: "2026-06-24T19:00:00Z", # BIH-QAT
    11: "2026-06-12T19:00:00Z", # BIH-CAN
    12: "2026-06-13T19:00:00Z", # QAT-SUI
    # Grupo C
    13: "2026-06-13T22:00:00Z", # BRA-MAR
    14: "2026-06-14T01:00:00Z", # HAI-SCO
    15: "2026-06-20T01:00:00Z", # BRA-HAI
    16: "2026-06-19T22:00:00Z", # SCO-MAR
    17: "2026-06-24T22:00:00Z", # SCO-BRA
    18: "2026-06-24T22:00:00Z", # MAR-HAI
    # Grupo D
    19: "2026-06-13T01:00:00Z", # USA-PAR
    20: "2026-06-14T04:00:00Z", # AUS-TUR
    21: "2026-06-19T19:00:00Z", # USA-AUS
    22: "2026-06-20T04:00:00Z", # TUR-PAR
    23: "2026-06-26T02:00:00Z", # TUR-USA
    24: "2026-06-26T02:00:00Z", # PAR-AUS
    # Grupo E
    25: "2026-06-14T17:00:00Z", # GER-CUW
    26: "2026-06-14T23:00:00Z", # CIV-ECU
    27: "2026-06-20T20:00:00Z", # GER-CIV
    28: "2026-06-21T00:00:00Z", # ECU-CUW
    29: "2026-06-25T20:00:00Z", # ECU-GER
    30: "2026-06-25T20:00:00Z", # CUW-CIV
    # Grupo F
    31: "2026-06-14T20:00:00Z", # NED-JPN
    32: "2026-06-15T02:00:00Z", # SWE-TUN
    33: "2026-06-20T17:00:00Z", # NED-SWE
    34: "2026-06-21T04:00:00Z", # TUN-JPN
    35: "2026-06-25T23:00:00Z", # TUN-NED
    36: "2026-06-25T23:00:00Z", # JPN-SWE
    # Grupo G
    37: "2026-06-15T22:00:00Z", # BEL-EGY
    38: "2026-06-16T04:00:00Z", # IRN-NZL
    39: "2026-06-21T19:00:00Z", # BEL-IRN
    40: "2026-06-22T01:00:00Z", # NZL-EGY
    41: "2026-06-27T03:00:00Z", # NZL-BEL
    42: "2026-06-27T03:00:00Z", # EGY-IRN
    # Grupo H
    43: "2026-06-15T17:00:00Z", # ESP-CPV
    44: "2026-06-15T22:00:00Z", # KSA-URU
    45: "2026-06-21T16:00:00Z", # ESP-KSA
    46: "2026-06-21T22:00:00Z", # URU-CPV
    47: "2026-06-27T00:00:00Z", # URU-ESP
    48: "2026-06-27T00:00:00Z", # CPV-KSA
    # Grupo I
    49: "2026-06-16T19:00:00Z", # FRA-SEN
    50: "2026-06-16T22:00:00Z", # IRQ-NOR
    51: "2026-06-22T21:00:00Z", # FRA-IRQ
    52: "2026-06-23T00:00:00Z", # NOR-SEN
    53: "2026-06-26T19:00:00Z", # NOR-FRA
    54: "2026-06-26T19:00:00Z", # SEN-IRQ
    # Grupo J
    55: "2026-06-17T01:00:00Z", # ARG-ALG
    56: "2026-06-17T04:00:00Z", # AUT-JOR
    57: "2026-06-22T17:00:00Z", # ARG-AUT
    58: "2026-06-23T03:00:00Z", # JOR-ALG
    59: "2026-06-28T02:00:00Z", # JOR-ARG
    60: "2026-06-28T02:00:00Z", # ALG-AUT
    # Grupo K
    61: "2026-06-23T17:00:00Z", # POR-UZB
    62: "2026-06-24T02:00:00Z", # COD-COL
    63: "2026-06-17T17:00:00Z", # POR-COD
    64: "2026-06-18T02:00:00Z", # COL-UZB
    65: "2026-06-27T23:30:00Z", # COL-POR
    66: "2026-06-27T23:30:00Z", # UZB-COD
    # Grupo L
    67: "2026-06-17T20:00:00Z", # ENG-CRO
    68: "2026-06-17T23:00:00Z", # GHA-PAN
    69: "2026-06-23T20:00:00Z", # ENG-GHA
    70: "2026-06-23T23:00:00Z", # PAN-CRO
    71: "2026-06-27T21:00:00Z", # PAN-ENG
    72: "2026-06-27T21:00:00Z", # CRO-GHA
    # --- KO (oficial FIFA, por match_number) ---
    73: "2026-06-28T19:00:00Z",
    74: "2026-06-29T20:30:00Z",
    75: "2026-06-30T01:00:00Z",
    76: "2026-06-29T17:00:00Z",
    77: "2026-06-30T21:00:00Z",
    78: "2026-06-30T17:00:00Z",
    79: "2026-07-01T01:00:00Z",
    80: "2026-07-01T16:00:00Z",
    81: "2026-07-02T00:00:00Z",
    82: "2026-07-01T20:00:00Z",
    83: "2026-07-02T23:00:00Z",
    84: "2026-07-02T19:00:00Z",
    85: "2026-07-03T03:00:00Z",
    86: "2026-07-03T22:00:00Z",
    87: "2026-07-04T01:30:00Z",
    88: "2026-07-03T18:00:00Z",
    89: "2026-07-04T21:00:00Z",
    90: "2026-07-04T17:00:00Z",
    91: "2026-07-05T20:00:00Z",
    92: "2026-07-06T00:00:00Z",
    93: "2026-07-06T19:00:00Z",
    94: "2026-07-07T00:00:00Z",
    95: "2026-07-07T16:00:00Z",
    96: "2026-07-07T20:00:00Z",
    97: "2026-07-09T20:00:00Z",
    98: "2026-07-10T19:00:00Z",
    99: "2026-07-11T21:00:00Z",
    100: "2026-07-12T01:00:00Z",
    101: "2026-07-14T19:00:00Z",
    102: "2026-07-15T19:00:00Z",
    103: "2026-07-18T21:00:00Z",
    104: "2026-07-19T19:00:00Z",
}

assert sorted(KICK) == list(range(1, 105)), "faltan match_numbers"


def write_migration() -> None:
    rows = ",\n".join(
        f"  ({n}, timestamptz '{KICK[n]}')" for n in range(1, 105)
    )
    sql = f"""-- 20260607093000_fix_real_match_dates.sql
-- Corrige las fechas/horarios de los 104 partidos al CALENDARIO REAL FIFA 2026.
-- El seed original usaba fechas placeholder sinteticas (GROUP_MATCH_DAYS en
-- scripts/seed_from_old_repo.py) y un orden round-robin inventado que NO
-- coincidia con el fixture real (ej: Suiza-Bosnia figuraba el 12/06 cuando se
-- juega el 18/06).
--
-- Fuentes: ESPN (fase de grupos) + Wikipedia "2026 FIFA World Cup knockout
-- stage" (KO). Horarios en UTC. El bracket de 0018 ya usa la numeracion
-- oficial FIFA, asi que el KO se mapea por match_number.
--
-- SOLO toca kickoff_at y lock_at (no resultados, no picks, no scoring).
-- lock_at = kickoff_at - 5 min (misma convencion que 20260530160000).
-- Defensivo: solo partidos no jugados (scheduled / pending_bracket).
-- Idempotente: valores absolutos, se puede correr varias veces.

update public.matches m
set kickoff_at = v.kickoff,
    lock_at    = v.kickoff - interval '5 minutes'
from (values
{rows}
) as v(num, kickoff)
where m.match_number = v.num
  and m.tournament_id = '{TID}'
  and m.status in ('scheduled', 'pending_bracket');
"""
    out = REPO / "supabase" / "migrations" / "20260607093000_fix_real_match_dates.sql"
    out.write_text(sql, encoding="utf-8")
    print(f"wrote {out.relative_to(REPO)} ({len(sql)} bytes)")


TS_RE = re.compile(r"'2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z'")
NUM_GROUP_RE = re.compile(r",\s*(\d+),\s*\(select id from public\.teams")
NUM_KO_RE = re.compile(r",\s*(\d+),\s*'")


def rewrite_seed(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    changed = 0
    for i, line in enumerate(lines):
        m = NUM_GROUP_RE.search(line) or NUM_KO_RE.search(line)
        if not m:
            continue
        num = int(m.group(1))
        if num not in KICK:
            continue
        ts = TS_RE.findall(line)
        if len(ts) != 2:
            continue  # no es una fila de match con kickoff+lock
        kick = f"'{KICK[num]}'"
        # lock_at = kickoff_at en el seed (la convencion -5min la aplica 0530160000)
        new_line = TS_RE.sub(kick, line)
        if new_line != line:
            lines[i] = new_line
            changed += 1
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"rewrote {path.relative_to(REPO)} ({changed} matches)")


if __name__ == "__main__":
    write_migration()
    rewrite_seed(REPO / "supabase" / "seed" / "03_matches_groups.sql")
    rewrite_seed(REPO / "supabase" / "seed" / "04_matches_ko.sql")
