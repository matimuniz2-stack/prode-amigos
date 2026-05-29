-- 01_tournament.sql
-- Generado por scripts/seed_from_old_repo.py
-- Idempotente via ON CONFLICT DO NOTHING.

insert into public.tournaments (id, slug, name, starts_at, ends_at, globals_lock_at, status, config) values
  ('00000000-0000-0000-0000-00000000a001', 'mundial-2026', 'Mundial FIFA 2026', '2026-06-11T16:00:00Z', '2026-07-19T20:00:00Z', '2026-06-11T15:00:00Z', 'registration', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.stages (tournament_id, code, name, scoring_profile, order_idx) values  ('00000000-0000-0000-0000-00000000a001', 'group', 'Fase de Grupos', 'group', 1),
  ('00000000-0000-0000-0000-00000000a001', 'r32', 'Dieciseisavos', 'r32', 2),
  ('00000000-0000-0000-0000-00000000a001', 'r16', 'Octavos', 'r16', 3),
  ('00000000-0000-0000-0000-00000000a001', 'qf', 'Cuartos', 'qf', 4),
  ('00000000-0000-0000-0000-00000000a001', 'sf', 'Semifinales', 'sf', 5),
  ('00000000-0000-0000-0000-00000000a001', 'tp', 'Tercer Puesto', 'tp', 6),
  ('00000000-0000-0000-0000-00000000a001', 'final', 'Final', 'final', 7)
on conflict (tournament_id, code) do nothing;

insert into public.groups (tournament_id, code) values  ('00000000-0000-0000-0000-00000000a001', 'A'),
  ('00000000-0000-0000-0000-00000000a001', 'B'),
  ('00000000-0000-0000-0000-00000000a001', 'C'),
  ('00000000-0000-0000-0000-00000000a001', 'D'),
  ('00000000-0000-0000-0000-00000000a001', 'E'),
  ('00000000-0000-0000-0000-00000000a001', 'F'),
  ('00000000-0000-0000-0000-00000000a001', 'G'),
  ('00000000-0000-0000-0000-00000000a001', 'H'),
  ('00000000-0000-0000-0000-00000000a001', 'I'),
  ('00000000-0000-0000-0000-00000000a001', 'J'),
  ('00000000-0000-0000-0000-00000000a001', 'K'),
  ('00000000-0000-0000-0000-00000000a001', 'L')
on conflict (tournament_id, code) do nothing;

insert into public.pools (id, tournament_id, total_amount, currency, status) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', 0, 'ARS', 'open')
on conflict (id) do nothing;

insert into public.prize_rules (pool_id, rule_key, share_pct, description) values  ('00000000-0000-0000-0000-00000000b001', 'overall_1st', 60.00, '1er puesto del prode'),
  ('00000000-0000-0000-0000-00000000b001', 'overall_2nd', 25.00, '2do puesto del prode'),
  ('00000000-0000-0000-0000-00000000b001', 'overall_3rd', 15.00, '3er puesto del prode')
on conflict (pool_id, rule_key) do nothing;
