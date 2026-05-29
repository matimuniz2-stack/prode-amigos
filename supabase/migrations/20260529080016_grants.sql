-- 0016_grants.sql
-- Supabase movio el default de auto_expose_new_tables a false en cloud
-- desde 2026-05-30. Hay que dar GRANT explicito a los roles anon y
-- authenticated para que la Data API exponga las tablas. La RLS sigue
-- siendo la barrera de seguridad real; el GRANT solo dice "el rol puede
-- intentar tocar la tabla, despues RLS decide si lo deja".

-- Lectura publica
grant select on public.profiles to anon, authenticated;
grant select on public.tournaments to anon, authenticated;
grant select on public.stages to anon, authenticated;
grant select on public.groups to anon, authenticated;
grant select on public.teams to anon, authenticated;
grant select on public.matches to anon, authenticated;
grant select on public.match_events to anon, authenticated;
grant select on public.pools to anon, authenticated;
grant select on public.prize_rules to anon, authenticated;
grant select on public.scoring_rules to anon, authenticated;
grant select on public.points_log to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
grant select on public.leaderboard_projection to anon, authenticated;

-- Picks: select + insert + update solo para authenticated
grant select, insert, update on public.match_predictions to authenticated;
grant select on public.match_prediction_history to authenticated;
grant select, insert, update on public.global_predictions to authenticated;

-- Admin reads
grant select on public.audit_log to authenticated;

-- Sequences usadas por inserts
grant usage on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant usage on sequences to authenticated;

-- Profile update
grant update on public.profiles to authenticated;
