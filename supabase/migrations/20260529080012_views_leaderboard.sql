-- 0012_views_leaderboard.sql
-- View NORMAL (no MATERIALIZED segun ajustes PASO 0) que resume puntos
-- por usuario y proyecta el premio segun prize_rules.

create or replace view public.leaderboard as
  select
    pl.tournament_id,
    pl.user_id,
    p.nickname,
    p.avatar_url,
    coalesce(sum(pl.points), 0)::int as total_points,
    count(*) filter (where pl.source_kind = 'match') as match_picks_scored,
    count(*) filter (where pl.source_kind = 'global') as globals_scored
  from public.points_log pl
  join public.profiles p on p.id = pl.user_id
  group by pl.tournament_id, pl.user_id, p.nickname, p.avatar_url;

-- Ranking + projected_prize.
-- projected_prize = pool.total_amount * prize_rules.share_pct / 100
-- (o fixed_amount si la regla es absoluta).
create or replace view public.leaderboard_projection as
with ranked as (
  select
    lb.tournament_id, lb.user_id, lb.nickname, lb.avatar_url,
    lb.total_points,
    rank() over (
      partition by lb.tournament_id order by lb.total_points desc
    ) as rnk
  from public.leaderboard lb
), pool_info as (
  select pl.tournament_id, pl.total_amount, pl.currency
  from public.pools pl
), prizes as (
  select
    pr.pool_id, pr.rule_key, pr.share_pct, pr.fixed_amount,
    case pr.rule_key
      when 'overall_1st' then 1
      when 'overall_2nd' then 2
      when 'overall_3rd' then 3
      else null
    end as target_rank
  from public.prize_rules pr
)
select
  r.tournament_id,
  r.user_id,
  r.nickname,
  r.avatar_url,
  r.total_points,
  r.rnk as rank,
  pi.currency,
  pi.total_amount as pool_total,
  coalesce(
    pz.fixed_amount,
    case when pz.share_pct is not null and pi.total_amount is not null
      then round(pi.total_amount * pz.share_pct / 100.0, 2)
      else 0
    end,
    0
  ) as projected_prize
from ranked r
left join pool_info pi on pi.tournament_id = r.tournament_id
left join public.pools p on p.tournament_id = r.tournament_id
left join prizes pz on pz.pool_id = p.id and pz.target_rank = r.rnk;

grant select on public.leaderboard to anon, authenticated;
grant select on public.leaderboard_projection to anon, authenticated;
