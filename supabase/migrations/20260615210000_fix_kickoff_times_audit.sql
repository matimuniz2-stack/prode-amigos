-- 20260615210000_fix_kickoff_times_audit.sql
-- Re-auditoría de horarios (2026-06-15) tras el incidente del #37 BEL-EGY.
-- La migración 20260607093000 cargó la fase de grupos a mano "desde ESPN" y
-- quedaron 6 partidos con el kickoff_at mal (slot válido, horario equivocado;
-- el tipo de error que no detecta ninguna validación estructural).
--
-- El #37 (BEL-EGY) ya se corrigió en caliente el día del incidente.
-- Acá van los otros 5, verificados uno por uno contra las páginas oficiales
-- por grupo de Wikipedia (equipos + hora local + offset UTC explícito) y
-- cruzados con FIFA.com / sitios oficiales de los estadios:
--
--   #38 IRN-NZL  04:00Z -> 01:00Z  (+3h)  SoFi, LA (6pm PT). URGENTE: se jugaba HOY.
--   #3  MEX-KOR  03:00Z -> 01:00Z  (+2h)  Estadio Akron, Guadalajara (7pm UTC-6).
--   #22 TUR-PAR  04:00Z -> 03:00Z  (+1h)  Levi's, Santa Clara (8pm PT).
--   #43 ESP-CPV  17:00Z -> 16:00Z  (+1h)  Mercedes-Benz, Atlanta (12pm ET). Ya jugado 0-0.
--   #15 BRA-HAI  01:00Z -> 00:30Z  (+30m) Lincoln Financial, Philadelphia (8:30pm ET).
--
-- Patrón probable del error: para varias sedes Pacific/Mexico se guardó la hora
-- "wall-clock Eastern" de las tablas de prensa como si fuera la local de la sede
-- (#3 y #38 son los casos de +2h/+3h). El resto del calendario (otros 66 de
-- grupos + los 32 de KO) se verificó correcto.
--
-- SOLO toca kickoff_at y lock_at (no resultados, no picks, no scoring).
-- lock_at = kickoff_at - 5 min. Idempotente (valores absolutos).
-- Integridad: el #43 ya estaba jugado; se revisó match_prediction_history y el
-- único que editó en la ventana mal (Grego, 16:34Z) sacó 0 pts igual (0-0), así
-- que no hubo impacto en el ranking — no se recalcula nada.
--
-- NOTA: aplicada en prod el 2026-06-15 vía SQL editor (asentada en audit_log
-- como 'fix_kickoff_times'). Este archivo deja repo y prod sincronizados.

update public.matches m
set kickoff_at = v.kickoff,
    lock_at    = v.kickoff - interval '5 minutes'
from (values
  (3,  timestamptz '2026-06-19T01:00:00Z'),
  (15, timestamptz '2026-06-20T00:30:00Z'),
  (22, timestamptz '2026-06-20T03:00:00Z'),
  (38, timestamptz '2026-06-16T01:00:00Z'),
  (43, timestamptz '2026-06-15T16:00:00Z')
) as v(num, kickoff)
where m.match_number = v.num
  and m.tournament_id = '00000000-0000-0000-0000-00000000a001';
