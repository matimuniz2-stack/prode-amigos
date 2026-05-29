-- 0018_fix_ko_bracket.sql
-- Reemplaza los placeholders genéricos e inconsistentes de los matches KO
-- del seed por el bracket OFICIAL del Mundial 2026.
-- Fuente: bracket FIFA / Wikipedia "2026 FIFA World Cup knockout stage".
--
-- Formato de placeholder que resolve_ko_round va a interpretar:
--   '1X' / '2X'   = 1ro / 2do del grupo X (A..L)
--   '3RD-XXXXX'   = mejor tercero proveniente de uno de esos grupos
--                   (la asignación exacta sale de la tabla FIFA de terceros)
--   'WNN'         = ganador del partido NN
--   'LNN'         = perdedor del partido NN (para el 3er puesto)
--
-- Idempotente: es un UPDATE por match_number, se puede correr varias veces.

update public.matches m
set home_placeholder = v.home,
    away_placeholder = v.away
from (values
  -- Dieciseisavos (Round of 32)
  (73, '2A', '2B'),
  (74, '1E', '3RD-ABCDF'),
  (75, '1F', '2C'),
  (76, '1C', '2F'),
  (77, '1I', '3RD-CDFGH'),
  (78, '2E', '2I'),
  (79, '1A', '3RD-CEFHI'),
  (80, '1L', '3RD-EHIJK'),
  (81, '1D', '3RD-BEFIJ'),
  (82, '1G', '3RD-AEHIJ'),
  (83, '2K', '2L'),
  (84, '1H', '2J'),
  (85, '1B', '3RD-EFGIJ'),
  (86, '1J', '2H'),
  (87, '1K', '3RD-DEIJL'),
  (88, '2D', '2G'),
  -- Octavos (Round of 16)
  (89, 'W74', 'W77'),
  (90, 'W73', 'W75'),
  (91, 'W76', 'W78'),
  (92, 'W79', 'W80'),
  (93, 'W83', 'W84'),
  (94, 'W81', 'W82'),
  (95, 'W86', 'W88'),
  (96, 'W85', 'W87'),
  -- Cuartos
  (97, 'W89', 'W90'),
  (98, 'W93', 'W94'),
  (99, 'W91', 'W92'),
  (100, 'W95', 'W96'),
  -- Semifinales
  (101, 'W97', 'W98'),
  (102, 'W99', 'W100'),
  -- Tercer puesto y Final
  (103, 'L101', 'L102'),
  (104, 'W101', 'W102')
) as v(num, home, away)
where m.match_number = v.num
  and m.tournament_id = '00000000-0000-0000-0000-00000000a001';
