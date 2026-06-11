-- 20260611220000_leaderboard_todos.sql
-- El ranking arrancaba desde points_log, así que quien nunca puntuó
-- (ej: sin pick en el primer partido) no aparecía. Ahora arranca desde
-- profiles: todos los jugadores figuran, con 0 si no puntuaron.
-- leaderboard_projection (rank + premio) se apoya en esta view y no cambia.

create or replace view public.leaderboard as
  select
    t.id as tournament_id,
    p.id as user_id,
    p.nickname,
    p.avatar_url,
    coalesce(sum(pl.points), 0)::int as total_points,
    count(pl.points) filter (where pl.source_kind = 'match') as match_picks_scored,
    count(pl.points) filter (where pl.source_kind = 'global') as globals_scored
  from public.profiles p
  cross join public.tournaments t
  left join public.points_log pl
    on pl.user_id = p.id and pl.tournament_id = t.id
  group by t.id, p.id, p.nickname, p.avatar_url;
