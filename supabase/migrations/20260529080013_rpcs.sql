-- 0013_rpcs.sql
-- RPCs admin. Todos exigen role admin/owner y escriben audit_log en la
-- misma transaccion (reason NOT NULL en audit_log => RPC sin reason
-- aborta). Usan SECURITY DEFINER para evitar tener que dar GRANT extra.

-- ----------------------------------------------------------------------------
-- match_set_result(match_id, score_home, score_away, ko_winner_team_id, reason)
-- ----------------------------------------------------------------------------
create or replace function public.match_set_result(
  p_match_id uuid,
  p_score_home int,
  p_score_away int,
  p_ko_winner_team_id uuid,
  p_finalize boolean,
  p_reason text
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before public.matches%rowtype;
  v_after public.matches%rowtype;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido (min 3 chars)' using errcode = 'P0001';
  end if;

  select * into v_before from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match % no existe', p_match_id using errcode = 'P0002';
  end if;

  update public.matches
  set score_home = p_score_home,
      score_away = p_score_away,
      ko_winner_team_id = p_ko_winner_team_id,
      status = case when p_finalize then 'finished' else status end,
      finalized_at = case when p_finalize then now() else finalized_at end,
      result_source = coalesce(result_source, 'manual')
  where id = p_match_id
  returning * into v_after;

  insert into public.audit_log (
    actor_id, actor_role, action, target_table, target_id, reason,
    before_state, after_state
  ) values (
    auth.uid(),
    (select role from public.profiles where id = auth.uid()),
    'match_set_result', 'matches', p_match_id, p_reason,
    to_jsonb(v_before), to_jsonb(v_after)
  );

  if p_finalize then
    perform public.calculate_match(p_match_id);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- calculate_match(match_id): scoring engine para un partido
-- ----------------------------------------------------------------------------
create or replace function public.calculate_match(p_match_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_stage public.stages%rowtype;
  v_pred record;
  v_winner text;
  v_points int;
  v_total int := 0;
  v_breakdown jsonb;
  v_winner_pts int;
  v_exact_pts int;
  v_diff_pts int;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found or v_match.status <> 'finished' then
    return 0;
  end if;

  select * into v_stage from public.stages where id = v_match.stage_id;

  if v_match.score_home > v_match.score_away then
    v_winner := 'home';
  elsif v_match.score_home < v_match.score_away then
    v_winner := 'away';
  else
    v_winner := 'draw';
  end if;

  for v_pred in
    select * from public.match_predictions
    where match_id = p_match_id
      and state in ('open', 'locked')
  loop
    v_points := 0;
    v_breakdown := jsonb_build_object();

    select coalesce(sr.points, 0) into v_winner_pts
    from public.scoring_rules sr
    where sr.tournament_id = v_match.tournament_id
      and sr.rule_key = 'winner_correct'
      and (sr.scope_stage = v_stage.code or sr.scope_stage = '*')
      and sr.active_to is null
    order by case when sr.scope_stage = v_stage.code then 0 else 1 end
    limit 1;

    select coalesce(sr.points, 0) into v_exact_pts
    from public.scoring_rules sr
    where sr.tournament_id = v_match.tournament_id
      and sr.rule_key = 'exact_score'
      and (sr.scope_stage = v_stage.code or sr.scope_stage = '*')
      and sr.active_to is null
    order by case when sr.scope_stage = v_stage.code then 0 else 1 end
    limit 1;

    select coalesce(sr.points, 0) into v_diff_pts
    from public.scoring_rules sr
    where sr.tournament_id = v_match.tournament_id
      and sr.rule_key = 'goal_diff_correct'
      and sr.active_to is null
    limit 1;

    if v_pred.predicted_winner = v_winner then
      v_points := v_points + v_winner_pts;
      v_breakdown := v_breakdown || jsonb_build_object('winner_correct', v_winner_pts);

      if v_pred.predicted_home = v_match.score_home
        and v_pred.predicted_away = v_match.score_away then
        v_points := v_points + v_exact_pts;
        v_breakdown := v_breakdown || jsonb_build_object('exact_score', v_exact_pts);
      elsif (v_pred.predicted_home - v_pred.predicted_away)
            = (v_match.score_home - v_match.score_away) then
        v_points := v_points + v_diff_pts;
        v_breakdown := v_breakdown || jsonb_build_object('goal_diff_correct', v_diff_pts);
      end if;
    end if;

    insert into public.points_log (
      user_id, tournament_id, source_kind, source_id,
      rule_key, scope_stage, points, breakdown
    ) values (
      v_pred.user_id, v_match.tournament_id, 'match', p_match_id,
      'aggregate', v_stage.code, v_points, v_breakdown
    )
    on conflict (user_id, source_kind, source_id, rule_key)
    do update set points = excluded.points,
                  breakdown = excluded.breakdown,
                  awarded_at = now();

    update public.match_predictions
    set state = 'scored', scored_at = now()
    where id = v_pred.id;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- ----------------------------------------------------------------------------
-- recalc_match / recalc_all
-- ----------------------------------------------------------------------------
create or replace function public.recalc_match(p_match_id uuid, p_reason text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare v_count int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;
  v_count := public.calculate_match(p_match_id);
  insert into public.audit_log (actor_id, action, target_table, target_id, reason)
  values (auth.uid(), 'recalc_match', 'matches', p_match_id, p_reason);
  return v_count;
end;
$$;

create or replace function public.recalc_all(p_tournament_id uuid, p_reason text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_total int := 0;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;
  for v_match in
    select id from public.matches
    where tournament_id = p_tournament_id and status = 'finished'
  loop
    v_total := v_total + public.calculate_match(v_match.id);
  end loop;
  insert into public.audit_log (actor_id, action, target_table, target_id, reason)
  values (auth.uid(), 'recalc_all', 'tournaments', p_tournament_id, p_reason);
  return v_total;
end;
$$;

-- ----------------------------------------------------------------------------
-- resolve_global / revert_ko_round / resolve_ko_round
-- ----------------------------------------------------------------------------
-- resolve_global: normaliza el nombre del jugador para top_scorer/mvp/
-- revelation y otorga los puntos al usuario que acerto.
create or replace function public.resolve_global(
  p_tournament_id uuid,
  p_category text,
  p_team_id uuid,
  p_player_name text,
  p_reason text
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_winner_pts int;
  v_count int := 0;
  v_pred record;
  v_norm text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;

  select points into v_winner_pts
  from public.scoring_rules
  where tournament_id = p_tournament_id
    and rule_key = p_category
    and active_to is null
  limit 1;

  v_norm := lower(trim(coalesce(p_player_name, '')));

  for v_pred in
    select * from public.global_predictions
    where tournament_id = p_tournament_id and category = p_category
  loop
    if p_category in ('champion', 'runner_up') then
      if v_pred.team_id = p_team_id then
        insert into public.points_log (
          user_id, tournament_id, source_kind, source_id,
          rule_key, points, breakdown
        ) values (
          v_pred.user_id, p_tournament_id, 'global', v_pred.id,
          p_category, v_winner_pts,
          jsonb_build_object('category', p_category, 'team_id', p_team_id)
        )
        on conflict (user_id, source_kind, source_id, rule_key) do update
          set points = excluded.points, awarded_at = now();
        v_count := v_count + 1;
      end if;
    else
      if v_pred.player_team_id = p_team_id
        and lower(trim(v_pred.player_name)) = v_norm then
        insert into public.points_log (
          user_id, tournament_id, source_kind, source_id,
          rule_key, points, breakdown
        ) values (
          v_pred.user_id, p_tournament_id, 'global', v_pred.id,
          p_category, v_winner_pts,
          jsonb_build_object('category', p_category, 'team_id', p_team_id, 'player', v_norm)
        )
        on conflict (user_id, source_kind, source_id, rule_key) do update
          set points = excluded.points, awarded_at = now();
        v_count := v_count + 1;
      end if;
    end if;

    update public.global_predictions
    set state = 'scored', scored_at = now()
    where id = v_pred.id;
  end loop;

  insert into public.audit_log (actor_id, action, target_table, target_id, reason, after_state)
  values (auth.uid(), 'resolve_global', 'global_predictions', null, p_reason,
          jsonb_build_object('category', p_category, 'team_id', p_team_id,
                             'player', v_norm, 'awarded', v_count));
  return v_count;
end;
$$;

-- admin_view_predictions: poder ver picks de un user particular antes
-- del lock (privacidad). Requiere doble reason y queda en audit.
create or replace function public.admin_view_predictions(
  p_user_id uuid, p_reason text
) returns setof public.match_predictions
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'reason requerido (min 10 chars, va a quedar en audit)'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, reason)
  values (auth.uid(), 'admin_view_predictions', 'auth.users', p_user_id, p_reason);

  return query
    select * from public.match_predictions where user_id = p_user_id;
end;
$$;

-- resolve_ko_round / revert_ko_round: el plan los marca como necesarios
-- pero requieren la logica de criterios FIFA para clasificados (puntos,
-- DG, GF, head-to-head, ranking de terceros via Anexo C). Implementacion
-- completa queda para una segunda migracion despues del primer fixture.
-- Por ahora un stub que solo cambia status para que el flujo de UI corra.

create or replace function public.resolve_ko_round(
  p_tournament_id uuid, p_stage_code text, p_reason text
) returns int
language plpgsql
security definer set search_path = public
as $$
declare v_count int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;

  update public.matches m
  set status = 'scheduled'
  from public.stages s
  where s.id = m.stage_id
    and s.tournament_id = p_tournament_id
    and s.code = p_stage_code
    and m.status = 'pending_bracket';
  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, action, target_table, reason, after_state)
  values (auth.uid(), 'resolve_ko_round', 'matches', p_reason,
          jsonb_build_object('stage', p_stage_code, 'unlocked', v_count));
  return v_count;
end;
$$;

create or replace function public.revert_ko_round(
  p_tournament_id uuid, p_stage_code text, p_reason text
) returns int
language plpgsql
security definer set search_path = public
as $$
declare v_count int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;

  -- Solo permite revertir si nadie cargo picks aun en esa fase
  if exists (
    select 1
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    join public.stages s on s.id = m.stage_id
    where s.tournament_id = p_tournament_id and s.code = p_stage_code
  ) then
    raise exception 'Ya hay picks cargados en %, no se puede revertir sin force', p_stage_code
      using errcode = 'P0001';
  end if;

  update public.matches m
  set status = 'pending_bracket', home_team_id = null, away_team_id = null
  from public.stages s
  where s.id = m.stage_id and s.tournament_id = p_tournament_id and s.code = p_stage_code;
  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, action, target_table, reason, after_state)
  values (auth.uid(), 'revert_ko_round', 'matches', p_reason,
          jsonb_build_object('stage', p_stage_code, 'reverted', v_count));
  return v_count;
end;
$$;

grant execute on function public.match_set_result(uuid, int, int, uuid, boolean, text) to authenticated;
grant execute on function public.recalc_match(uuid, text) to authenticated;
grant execute on function public.recalc_all(uuid, text) to authenticated;
grant execute on function public.resolve_global(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.admin_view_predictions(uuid, text) to authenticated;
grant execute on function public.resolve_ko_round(uuid, text, text) to authenticated;
grant execute on function public.revert_ko_round(uuid, text, text) to authenticated;
