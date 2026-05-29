-- 0019_resolve_brackets.sql
-- resolve_brackets: puebla los cruces de eliminación con los equipos reales
-- A MEDIDA que se van conociendo. Idempotente (se puede correr muchas veces,
-- la dispara el admin o un cron). Hace SOLO lo determinista:
--   1) 1ro y 2do de cada grupo COMPLETO  -> slots '1X' / '2X'
--   2) ganador/perdedor de cada partido KO terminado -> slots 'WNN' / 'LNN'
--   3) pasa a 'scheduled' los partidos que ya tienen los dos equipos
--      (ahí recién se abren los picks).
-- La asignación de los 8 MEJORES TERCEROS (slots '3RD-...') NO se toca acá:
-- va aparte con revisión del admin (resolve_thirds + pantalla, próxima entrega).
--
-- Desempate de grupo: puntos -> diferencia de gol -> goles a favor. Empates
-- EXACTOS en esos 3 (rarísimos) los ajusta el admin a mano — el mano a mano /
-- fair-play / ranking FIFA no se automatizan en MVP.

create or replace function public.resolve_brackets(
  p_tournament_id uuid,
  p_reason text
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_grp record;
  v_first uuid;
  v_second uuid;
  v_km record;
  v_winner uuid;
  v_loser uuid;
  v_scheduled int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;

  -- 1) 1ro y 2do de cada grupo que ya terminó (sus 3 partidos finished)
  for v_grp in
    select g.id as group_id, g.code
    from public.groups g
    where g.tournament_id = p_tournament_id
  loop
    if exists (
      select 1
      from public.matches m
      join public.stages s on s.id = m.stage_id
      where m.group_id = v_grp.group_id
        and s.code = 'group'
        and m.status <> 'finished'
    ) then
      continue; -- el grupo todavía no terminó
    end if;

    with grp as (
      select m.home_team_id as ht, m.away_team_id as at,
             m.score_home as sh, m.score_away as sa
      from public.matches m
      join public.stages s on s.id = m.stage_id
      where m.group_id = v_grp.group_id
        and s.code = 'group'
        and m.status = 'finished'
    ),
    res as (
      select ht as team,
             (case when sh > sa then 3 when sh = sa then 1 else 0 end) as pts,
             sh as gf, sa as ga
      from grp
      union all
      select at,
             (case when sa > sh then 3 when sa = sh then 1 else 0 end),
             sa, sh
      from grp
    ),
    tbl as (
      select team, sum(pts) as pts, sum(gf - ga) as dg, sum(gf) as gf
      from res
      group by team
    ),
    ranked as (
      select team,
             row_number() over (order by pts desc, dg desc, gf desc) as rn
      from tbl
    )
    select max(case when rn = 1 then team end),
           max(case when rn = 2 then team end)
    into v_first, v_second
    from ranked;

    update public.matches set home_team_id = v_first
      where tournament_id = p_tournament_id
        and home_placeholder = '1' || v_grp.code and home_team_id is null;
    update public.matches set away_team_id = v_first
      where tournament_id = p_tournament_id
        and away_placeholder = '1' || v_grp.code and away_team_id is null;
    update public.matches set home_team_id = v_second
      where tournament_id = p_tournament_id
        and home_placeholder = '2' || v_grp.code and home_team_id is null;
    update public.matches set away_team_id = v_second
      where tournament_id = p_tournament_id
        and away_placeholder = '2' || v_grp.code and away_team_id is null;
  end loop;

  -- 2) Avance: ganador / perdedor de cada partido KO ya terminado
  for v_km in
    select match_number, home_team_id, away_team_id,
           score_home, score_away, ko_winner_team_id
    from public.matches
    where tournament_id = p_tournament_id
      and status = 'finished'
      and score_home is not null and score_away is not null
  loop
    v_winner := coalesce(
      v_km.ko_winner_team_id,
      case
        when v_km.score_home > v_km.score_away then v_km.home_team_id
        when v_km.score_away > v_km.score_home then v_km.away_team_id
        else null
      end
    );
    if v_winner is null then
      continue; -- empate sin ganador definido (faltó cargar ko_winner)
    end if;
    v_loser := case
      when v_winner = v_km.home_team_id then v_km.away_team_id
      else v_km.home_team_id
    end;

    update public.matches set home_team_id = v_winner
      where tournament_id = p_tournament_id
        and home_placeholder = 'W' || v_km.match_number and home_team_id is null;
    update public.matches set away_team_id = v_winner
      where tournament_id = p_tournament_id
        and away_placeholder = 'W' || v_km.match_number and away_team_id is null;
    update public.matches set home_team_id = v_loser
      where tournament_id = p_tournament_id
        and home_placeholder = 'L' || v_km.match_number and home_team_id is null;
    update public.matches set away_team_id = v_loser
      where tournament_id = p_tournament_id
        and away_placeholder = 'L' || v_km.match_number and away_team_id is null;
  end loop;

  -- 3) Abrir (scheduled) los partidos que ya tienen los dos equipos
  update public.matches set status = 'scheduled'
  where tournament_id = p_tournament_id
    and status = 'pending_bracket'
    and home_team_id is not null
    and away_team_id is not null;
  get diagnostics v_scheduled = row_count;

  insert into public.audit_log (actor_id, action, target_table, reason, after_state)
  values (auth.uid(), 'resolve_brackets', 'matches', p_reason,
          jsonb_build_object('newly_scheduled', v_scheduled));

  return v_scheduled;
end;
$$;

grant execute on function public.resolve_brackets(uuid, text) to authenticated;
