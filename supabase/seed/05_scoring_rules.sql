-- 05_scoring_rules.sql
-- Generado por scripts/seed_from_old_repo.py
-- Idempotente via ON CONFLICT DO NOTHING.

insert into public.scoring_rules (tournament_id, rule_key, scope_stage, points, version) values
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'group', 2, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'group', 3, 1),
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'r32', 4, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'r32', 6, 1),
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'r16', 6, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'r16', 9, 1),
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'qf', 8, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'qf', 12, 1),
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'sf', 11, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'sf', 16, 1),
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'tp', 13, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'tp', 19, 1),
  ('00000000-0000-0000-0000-00000000a001', 'winner_correct', 'final', 15, 1),
  ('00000000-0000-0000-0000-00000000a001', 'exact_score', 'final', 22, 1),
  ('00000000-0000-0000-0000-00000000a001', 'champion', NULL, 25, 1),
  ('00000000-0000-0000-0000-00000000a001', 'runner_up', NULL, 10, 1),
  ('00000000-0000-0000-0000-00000000a001', 'top_scorer', NULL, 30, 1),
  ('00000000-0000-0000-0000-00000000a001', 'mvp', NULL, 35, 1),
  ('00000000-0000-0000-0000-00000000a001', 'revelation', NULL, 8, 1)
on conflict (tournament_id, rule_key, scope_stage, version) do nothing;
