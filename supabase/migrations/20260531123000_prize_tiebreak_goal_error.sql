-- 0027_prize_tiebreak_goal_error.sql
-- Auditoría 2026-05-31 (hallazgo crítico #2): un empate en un puesto con
-- premio repartía de más (dos en 1° proyectaban 60% c/u, nadie el 25% → 135%
-- del pozo). Decisión de Mati: DESEMPATE POR CERCANÍA DE GOLES.
--
-- Cada usuario acumula un "error de goles": por cada partido finalizado,
-- |pred_home - real_home| + |pred_away - real_away|, sumado. Menos error =
-- estuviste más cerca = mejor. Se usa como 2º criterio de orden (después de
-- los puntos). Magnitud (abs), no signo, para que over/under no se cancelen.
--
-- Red de seguridad: si dos quedan iguales en puntos Y en error de goles
-- (residual, muy raro), los premios de los puestos que ocupa el grupo se
-- suman y se reparten en partes iguales → nunca se reparte de más.
--
-- goal_error se agrega como columna NUEVA AL FINAL para que CREATE OR REPLACE
-- VIEW no rompa (no se puede insertar columnas en el medio).

create or replace view public.leaderboard_projection as
with goal_err as (
  select
    mp.user_id,
    m.tournament_id,
    sum(abs(mp.predicted_home - m.score_home)
        + abs(mp.predicted_away - m.score_away)) as goal_error
  from public.match_predictions mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'finished'
    and m.score_home is not null
    and m.score_away is not null
  group by mp.user_id, m.tournament_id
),
ranked as (
  select
    lb.tournament_id,
    lb.user_id,
    lb.nickname,
    lb.avatar_url,
    lb.total_points,
    coalesce(ge.goal_error, 0) as goal_error,
    rank() over (
      partition by lb.tournament_id
      order by lb.total_points desc, coalesce(ge.goal_error, 0) asc
    ) as rnk,
    count(*) over (
      partition by lb.tournament_id, lb.total_points, coalesce(ge.goal_error, 0)
    ) as tie_size
  from public.leaderboard lb
  left join goal_err ge
    on ge.user_id = lb.user_id and ge.tournament_id = lb.tournament_id
),
pool_info as (
  select pl.tournament_id, pl.id as pool_id, pl.total_amount, pl.currency
  from public.pools pl
),
prize_by_rank as (
  select
    pr.pool_id,
    case pr.rule_key
      when 'overall_1st' then 1
      when 'overall_2nd' then 2
      when 'overall_3rd' then 3
    end as target_rank,
    pr.share_pct,
    pr.fixed_amount
  from public.prize_rules pr
  where pr.rule_key in ('overall_1st', 'overall_2nd', 'overall_3rd')
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
  coalesce((
    select round(
      sum(
        coalesce(
          pbr.fixed_amount,
          case when pbr.share_pct is not null and pi.total_amount is not null
            then pi.total_amount * pbr.share_pct / 100.0
            else 0
          end
        )
      ) / r.tie_size, 2)
    from prize_by_rank pbr
    where pbr.pool_id = pi.pool_id
      and pbr.target_rank between r.rnk and r.rnk + r.tie_size - 1
  ), 0) as projected_prize,
  r.goal_error
from ranked r
left join pool_info pi on pi.tournament_id = r.tournament_id;

grant select on public.leaderboard_projection to anon, authenticated;
