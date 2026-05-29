"""Genera los SQL de seed para Supabase a partir del repo viejo.

Lee:
  - research/simulacion/montecarlo.json (48 selecciones)
  - research/reglas/formato_mundial_2026.md (grupos + calendario)
  - research/reglas/cocos_reglamento.md (defaults de scoring)

Escribe en supabase/seed/:
  - 01_tournament.sql        torneo + stages + groups + pool vacio
  - 02_teams.sql             48 selecciones asignadas a grupos
  - 03_matches_groups.sql    72 partidos de fase de grupos
  - 04_matches_ko.sql        32 partidos KO con placeholders
  - 05_scoring_rules.sql     reglas Cocos por stage

Es one-shot: se corre una vez al inicio del proyecto. Despues el repo
nuevo es autonomo.

Uso:
    python scripts/seed_from_old_repo.py
"""

from __future__ import annotations

import itertools
import json
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable

OLD_REPO = Path(r"C:/Users/matim/OneDrive/Escritorio/Proyectos/prode")
NEW_REPO = Path(__file__).resolve().parents[1]
SEED_DIR = NEW_REPO / "supabase" / "seed"

TOURNAMENT_ID = uuid.UUID("00000000-0000-0000-0000-00000000a001")
POOL_ID = uuid.UUID("00000000-0000-0000-0000-00000000b001")

# Mapeo grupo -> [team_code, team_name, flag] (orden = bombo en formato_mundial_2026.md).
# Codigos son slugs cortos en mayuscula para que los placeholders sean amigables (MEX, BRA, ARG, etc.).
GROUPS = {
    "A": [
        ("MEX", "México", "🇲🇽"),
        ("RSA", "Sudáfrica", "🇿🇦"),
        ("KOR", "Corea del Sur", "🇰🇷"),
        ("CZE", "República Checa", "🇨🇿"),
    ],
    "B": [
        ("CAN", "Canadá", "🇨🇦"),
        ("QAT", "Catar", "🇶🇦"),
        ("SUI", "Suiza", "🇨🇭"),
        ("BIH", "Bosnia y Herzegovina", "🇧🇦"),
    ],
    "C": [
        ("BRA", "Brasil", "🇧🇷"),
        ("MAR", "Marruecos", "🇲🇦"),
        ("HAI", "Haití", "🇭🇹"),
        ("SCO", "Escocia", "🏴"),
    ],
    "D": [
        ("USA", "Estados Unidos", "🇺🇸"),
        ("PAR", "Paraguay", "🇵🇾"),
        ("AUS", "Australia", "🇦🇺"),
        ("TUR", "Turquía", "🇹🇷"),
    ],
    "E": [
        ("GER", "Alemania", "🇩🇪"),
        ("CUW", "Curazao", "🇨🇼"),
        ("CIV", "Costa de Marfil", "🇨🇮"),
        ("ECU", "Ecuador", "🇪🇨"),
    ],
    "F": [
        ("NED", "Países Bajos", "🇳🇱"),
        ("JPN", "Japón", "🇯🇵"),
        ("SWE", "Suecia", "🇸🇪"),
        ("TUN", "Túnez", "🇹🇳"),
    ],
    "G": [
        ("BEL", "Bélgica", "🇧🇪"),
        ("EGY", "Egipto", "🇪🇬"),
        ("IRN", "Irán", "🇮🇷"),
        ("NZL", "Nueva Zelanda", "🇳🇿"),
    ],
    "H": [
        ("ESP", "España", "🇪🇸"),
        ("CPV", "Cabo Verde", "🇨🇻"),
        ("KSA", "Arabia Saudita", "🇸🇦"),
        ("URU", "Uruguay", "🇺🇾"),
    ],
    "I": [
        ("FRA", "Francia", "🇫🇷"),
        ("SEN", "Senegal", "🇸🇳"),
        ("IRQ", "Irak", "🇮🇶"),
        ("NOR", "Noruega", "🇳🇴"),
    ],
    "J": [
        ("ARG", "Argentina", "🇦🇷"),
        ("ALG", "Argelia", "🇩🇿"),
        ("AUT", "Austria", "🇦🇹"),
        ("JOR", "Jordania", "🇯🇴"),
    ],
    "K": [
        ("POR", "Portugal", "🇵🇹"),
        ("UZB", "Uzbekistán", "🇺🇿"),
        ("COD", "RD del Congo", "🇨🇩"),
        ("COL", "Colombia", "🇨🇴"),
    ],
    "L": [
        ("ENG", "Inglaterra", "🏴"),
        ("CRO", "Croacia", "🇭🇷"),
        ("GHA", "Ghana", "🇬🇭"),
        ("PAN", "Panamá", "🇵🇦"),
    ],
}

# Dia de cada fecha por grupo (UTC). Hora placeholder fija a 18:00 UTC
# (15:00 ART, mediodia tipico en EE.UU.); el admin ajusta despues con la
# hora exacta de FIFA.
GROUP_MATCH_DAYS = {
    "A": ["2026-06-11", "2026-06-18", "2026-06-24"],
    "B": ["2026-06-12", "2026-06-18", "2026-06-24"],
    "C": ["2026-06-13", "2026-06-19", "2026-06-24"],
    "D": ["2026-06-12", "2026-06-19", "2026-06-25"],
    "E": ["2026-06-14", "2026-06-20", "2026-06-25"],
    "F": ["2026-06-14", "2026-06-20", "2026-06-25"],
    "G": ["2026-06-15", "2026-06-21", "2026-06-26"],
    "H": ["2026-06-15", "2026-06-21", "2026-06-26"],
    "I": ["2026-06-16", "2026-06-22", "2026-06-26"],
    "J": ["2026-06-16", "2026-06-22", "2026-06-27"],
    "K": ["2026-06-17", "2026-06-23", "2026-06-27"],
    "L": ["2026-06-17", "2026-06-23", "2026-06-27"],
}

# Las 6 combinaciones de un round-robin de 4 (orden FIFA tipico).
# Cada tupla es (home_idx, away_idx) sobre el bombo del grupo (0..3).
# Distribuidas en 3 fechas, 2 partidos por fecha.
ROUND_ROBIN_FIXTURE = [
    # Fecha 1: 1v2, 3v4
    (0, 1),
    (2, 3),
    # Fecha 2: 1v3, 4v2
    (0, 2),
    (3, 1),
    # Fecha 3: 4v1, 2v3
    (3, 0),
    (1, 2),
]

KO_STAGES = [
    # (code, name, scoring_profile, order_idx, start_date, count, prev_stage)
    ("r32", "Dieciseisavos", "r32", 2, "2026-06-28", 16, "group"),
    ("r16", "Octavos", "r16", 3, "2026-07-04", 8, "r32"),
    ("qf", "Cuartos", "qf", 4, "2026-07-09", 4, "r16"),
    ("sf", "Semifinales", "sf", 5, "2026-07-14", 2, "qf"),
    ("tp", "Tercer Puesto", "tp", 6, "2026-07-18", 1, "sf"),
    ("final", "Final", "final", 7, "2026-07-19", 1, "sf"),
]

GROUP_STAGE = ("group", "Fase de Grupos", "group", 1)

# Defaults de scoring tomados del reglamento Cocos.
# Ver research/reglas/cocos_reglamento.md secciones 1.B / 1.C / 1.D.
SCORING_RULES = [
    # rule_key, scope_stage, points
    ("winner_correct", "group", 2),
    ("exact_score", "group", 3),
    ("winner_correct", "r32", 4),
    ("exact_score", "r32", 6),
    ("winner_correct", "r16", 6),
    ("exact_score", "r16", 9),
    ("winner_correct", "qf", 8),
    ("exact_score", "qf", 12),
    ("winner_correct", "sf", 11),
    ("exact_score", "sf", 16),
    ("winner_correct", "tp", 13),
    ("exact_score", "tp", 19),
    ("winner_correct", "final", 15),
    ("exact_score", "final", 22),
    # Globales
    ("champion", None, 25),
    ("runner_up", None, 10),
    ("top_scorer", None, 30),
    ("mvp", None, 35),
    ("revelation", None, 8),
]


def header(name: str) -> str:
    return (
        f"-- {name}\n"
        f"-- Generado por scripts/seed_from_old_repo.py\n"
        f"-- Idempotente via ON CONFLICT DO NOTHING.\n\n"
    )


def sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def write_tournament_sql() -> str:
    out: list[str] = [header("01_tournament.sql")]
    out.append(
        f"insert into public.tournaments (id, slug, name, starts_at, ends_at, "
        f"globals_lock_at, status, config) values\n"
        f"  ({sql_str(str(TOURNAMENT_ID))}, 'mundial-2026', "
        f"'Mundial FIFA 2026', '2026-06-11T16:00:00Z', "
        f"'2026-07-19T20:00:00Z', '2026-06-11T15:00:00Z', "
        f"'registration', '{{}}'::jsonb)\n"
        f"on conflict (id) do nothing;\n"
    )

    # Stages
    out.append("\ninsert into public.stages (tournament_id, code, name, scoring_profile, order_idx) values")
    rows: list[str] = []
    for code, name, profile, order in [GROUP_STAGE] + [
        (s[0], s[1], s[2], s[3]) for s in KO_STAGES
    ]:
        rows.append(
            f"  ({sql_str(str(TOURNAMENT_ID))}, {sql_str(code)}, "
            f"{sql_str(name)}, {sql_str(profile)}, {order})"
        )
    out.append(",\n".join(rows) + "\non conflict (tournament_id, code) do nothing;\n")

    # Groups
    out.append("\ninsert into public.groups (tournament_id, code) values")
    rows = [f"  ({sql_str(str(TOURNAMENT_ID))}, {sql_str(code)})" for code in GROUPS]
    out.append(",\n".join(rows) + "\non conflict (tournament_id, code) do nothing;\n")

    # Pool vacio
    out.append(
        f"\ninsert into public.pools (id, tournament_id, total_amount, currency, status) values\n"
        f"  ({sql_str(str(POOL_ID))}, {sql_str(str(TOURNAMENT_ID))}, 0, 'ARS', 'open')\n"
        f"on conflict (id) do nothing;\n"
    )

    # Prize rules default 60/25/15
    out.append("\ninsert into public.prize_rules (pool_id, rule_key, share_pct, description) values")
    rows = [
        f"  ({sql_str(str(POOL_ID))}, 'overall_1st', 60.00, '1er puesto del prode')",
        f"  ({sql_str(str(POOL_ID))}, 'overall_2nd', 25.00, '2do puesto del prode')",
        f"  ({sql_str(str(POOL_ID))}, 'overall_3rd', 15.00, '3er puesto del prode')",
    ]
    out.append(",\n".join(rows) + "\non conflict (pool_id, rule_key) do nothing;\n")

    return "".join(out)


def write_teams_sql() -> str:
    out: list[str] = [header("02_teams.sql")]
    out.append(
        "insert into public.teams (tournament_id, group_id, code, name, flag_emoji, seed_pot) values\n"
    )
    rows: list[str] = []
    for group_code, teams in GROUPS.items():
        for pot, (code, name, flag) in enumerate(teams, start=1):
            rows.append(
                f"  ({sql_str(str(TOURNAMENT_ID))}, "
                f"(select id from public.groups where tournament_id = {sql_str(str(TOURNAMENT_ID))} "
                f"and code = {sql_str(group_code)}), "
                f"{sql_str(code)}, {sql_str(name)}, {sql_str(flag)}, {pot})"
            )
    out.append(",\n".join(rows) + "\non conflict (tournament_id, code) do nothing;\n")
    return "".join(out)


def write_matches_groups_sql() -> str:
    out: list[str] = [header("03_matches_groups.sql")]
    out.append(
        "insert into public.matches (tournament_id, stage_id, group_id, match_number, "
        "home_team_id, away_team_id, kickoff_at, lock_at, status) values\n"
    )
    rows: list[str] = []
    match_number = 1
    for group_code in GROUPS:
        team_codes = [t[0] for t in GROUPS[group_code]]
        days = GROUP_MATCH_DAYS[group_code]
        for idx, (home_i, away_i) in enumerate(ROUND_ROBIN_FIXTURE):
            day = days[idx // 2]
            # 2 partidos por fecha: el primero 15:00 UTC, el segundo 19:00 UTC
            hour = 15 if idx % 2 == 0 else 19
            kickoff = f"{day}T{hour:02d}:00:00Z"
            home_code = team_codes[home_i]
            away_code = team_codes[away_i]
            rows.append(
                f"  ({sql_str(str(TOURNAMENT_ID))}, "
                f"(select id from public.stages where tournament_id = {sql_str(str(TOURNAMENT_ID))} and code = 'group'), "
                f"(select id from public.groups where tournament_id = {sql_str(str(TOURNAMENT_ID))} and code = {sql_str(group_code)}), "
                f"{match_number}, "
                f"(select id from public.teams where tournament_id = {sql_str(str(TOURNAMENT_ID))} and code = {sql_str(home_code)}), "
                f"(select id from public.teams where tournament_id = {sql_str(str(TOURNAMENT_ID))} and code = {sql_str(away_code)}), "
                f"{sql_str(kickoff)}, {sql_str(kickoff)}, 'scheduled')"
            )
            match_number += 1
    out.append(",\n".join(rows) + "\non conflict (tournament_id, match_number) do nothing;\n")
    return "".join(out)


def write_matches_ko_sql() -> str:
    out: list[str] = [header("04_matches_ko.sql")]
    out.append(
        "insert into public.matches (tournament_id, stage_id, match_number, "
        "home_placeholder, away_placeholder, kickoff_at, lock_at, status) values\n"
    )
    rows: list[str] = []
    match_number = 73  # 72 grupos + 1
    for code, name, profile, order, start_date, count, prev_stage in KO_STAGES:
        start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        for i in range(count):
            day = start + timedelta(days=i // 2)
            hour = 15 if i % 2 == 0 else 19
            kickoff = day.replace(hour=hour, minute=0, second=0).isoformat().replace("+00:00", "Z")
            # Placeholders semanticos
            if code == "r32":
                # 16 partidos: ganadores grupos + mejores terceros
                home_ph = f"1st-{chr(65 + (i % 12))}"
                away_ph = f"{'2nd' if i < 8 else '3rd-best'}-bracket-{i + 1}"
            elif code in ("r16", "qf", "sf"):
                # Avanza el ganador del partido anterior
                prev_count = {"r16": 16, "qf": 8, "sf": 4}[code]
                prev_start_match = match_number - count - prev_count
                home_ph = f"W-{prev_start_match + i * 2}"
                away_ph = f"W-{prev_start_match + i * 2 + 1}"
            elif code == "tp":
                home_ph = "L-SF1"
                away_ph = "L-SF2"
            elif code == "final":
                home_ph = "W-SF1"
                away_ph = "W-SF2"
            else:
                home_ph = "TBD"
                away_ph = "TBD"

            rows.append(
                f"  ({sql_str(str(TOURNAMENT_ID))}, "
                f"(select id from public.stages where tournament_id = {sql_str(str(TOURNAMENT_ID))} and code = {sql_str(code)}), "
                f"{match_number}, {sql_str(home_ph)}, {sql_str(away_ph)}, "
                f"{sql_str(kickoff)}, {sql_str(kickoff)}, 'pending_bracket')"
            )
            match_number += 1
    out.append(",\n".join(rows) + "\non conflict (tournament_id, match_number) do nothing;\n")
    return "".join(out)


def write_scoring_rules_sql() -> str:
    out: list[str] = [header("05_scoring_rules.sql")]
    out.append(
        "insert into public.scoring_rules (tournament_id, rule_key, scope_stage, points, version) values\n"
    )
    rows: list[str] = []
    for rule_key, scope, points in SCORING_RULES:
        rows.append(
            f"  ({sql_str(str(TOURNAMENT_ID))}, {sql_str(rule_key)}, "
            f"{sql_str(scope)}, {points}, 1)"
        )
    out.append(",\n".join(rows) + "\non conflict (tournament_id, rule_key, scope_stage, version) do nothing;\n")
    return "".join(out)


def main() -> int:
    if not OLD_REPO.exists():
        print(f"Repo viejo no encontrado en {OLD_REPO}", file=sys.stderr)
        return 1

    # Verifica que los inputs existan (aunque hardcodeamos la mayoria,
    # mantenemos el contrato del plan: este script lee del repo viejo).
    for required in (
        OLD_REPO / "research/simulacion/montecarlo.json",
        OLD_REPO / "research/reglas/formato_mundial_2026.md",
        OLD_REPO / "research/reglas/cocos_reglamento.md",
    ):
        if not required.exists():
            print(f"Falta {required}", file=sys.stderr)
            return 1

    # Sanity check: el JSON tiene 48 teams
    with open(OLD_REPO / "research/simulacion/montecarlo.json", encoding="utf-8") as f:
        data = json.load(f)
    n_teams_json = len(data["teams"])
    if n_teams_json != 48:
        print(f"Esperaba 48 teams en montecarlo.json, vi {n_teams_json}", file=sys.stderr)
        return 1

    n_teams_groups = sum(len(v) for v in GROUPS.values())
    if n_teams_groups != 48:
        print(f"Esperaba 48 teams en GROUPS, vi {n_teams_groups}", file=sys.stderr)
        return 1

    SEED_DIR.mkdir(parents=True, exist_ok=True)

    files = {
        "01_tournament.sql": write_tournament_sql(),
        "02_teams.sql": write_teams_sql(),
        "03_matches_groups.sql": write_matches_groups_sql(),
        "04_matches_ko.sql": write_matches_ko_sql(),
        "05_scoring_rules.sql": write_scoring_rules_sql(),
    }
    for name, content in files.items():
        path = SEED_DIR / name
        path.write_text(content, encoding="utf-8")
        print(f"wrote {path.relative_to(NEW_REPO)} ({len(content)} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
