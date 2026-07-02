-- 20260702170000_auto_advance_brackets.sql
-- El bracket avanza SOLO: cuando un partido de eliminación queda finished
-- (por el cron de ESPN o por el admin), el ganador se propaga a su slot
-- 'WNN' de la ronda siguiente y el cruce se abre (scheduled) apenas tiene
-- los dos equipos. Cubre octavos, cuartos, semis y final con el mismo
-- mecanismo (los placeholders W73..W88 -> 8vos, W89..W96 -> 4tos, etc).
--
-- Antes esto era manual: el admin corría resolve_brackets desde el panel.
-- resolve_brackets queda como está (botón manual + parte de grupos); acá se
-- extrae el núcleo KO en advance_brackets(), interna y sin check de admin,
-- y se llama al finalizar desde poll_results_apply y match_set_result.
--
-- En empates de 120' el ganador sale de ko_winner_team_id (el poller lo trae
-- de ESPN; si ESPN no lo marca, no finaliza y lo cierra el admin con el
-- ganador a mano) — el avance nunca adivina un ganador que no está.

-- ============================================================================
-- 1) advance_brackets: núcleo determinista del avance KO. Idempotente.
--    Interna: sin is_admin() (la llaman funciones definer ya autorizadas).
-- ============================================================================
create or replace function public.advance_brackets(p_tournament_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_km record;
  v_winner uuid;
  v_loser uuid;
  v_scheduled int;
begin
  -- Ganador / perdedor de cada KO terminado -> slots 'WNN' / 'LNN'
  for v_km in
    select m.match_number, m.home_team_id, m.away_team_id,
           m.score_home, m.score_away, m.ko_winner_team_id
    from public.matches m
    join public.stages s on s.id = m.stage_id
    where m.tournament_id = p_tournament_id
      and s.code <> 'group'
      and m.status = 'finished'
      and m.score_home is not null and m.score_away is not null
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
      continue; -- empate sin ganador cargado: no se adivina
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

  -- Abrir los cruces que ya tienen los dos equipos (ahí se habilitan los picks)
  update public.matches set status = 'scheduled'
  where tournament_id = p_tournament_id
    and status = 'pending_bracket'
    and home_team_id is not null
    and away_team_id is not null;
  get diagnostics v_scheduled = row_count;

  if v_scheduled > 0 then
    insert into public.audit_log (actor_id, actor_role, action, target_table, reason, after_state)
    values (auth.uid(), 'system', 'advance_brackets_auto', 'matches',
            'Avance automatico del bracket al finalizar un KO',
            jsonb_build_object('newly_scheduled', v_scheduled));
  end if;

  return v_scheduled;
end;
$$;

revoke all on function public.advance_brackets(uuid) from public, anon, authenticated;

-- ============================================================================
-- 2) poll_results_apply: igual que 20260611190000, + advance_brackets al
--    finalizar un partido (no-op para grupos: no hay slots que los referencien).
-- ============================================================================
create or replace function public.poll_results_apply(p_secret text, p_updates jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_match public.matches%rowtype;
  v_after public.matches%rowtype;
  v_score_home int;
  v_score_away int;
  v_finalize boolean;
  v_ko_winner uuid;
  v_is_group boolean;
  v_updated int := 0;
  v_finalized int := 0;
begin
  perform public.poll_check_access(p_secret);

  for v_item in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    select * into v_match
    from public.matches
    where id = (v_item->>'match_id')::uuid
    for update;
    if not found then continue; end if;

    if v_match.status <> 'live' then continue; end if;
    if v_match.result_source is not null and v_match.result_source <> 'espn' then
      continue;
    end if;

    v_score_home := (v_item->>'score_home')::int;
    v_score_away := (v_item->>'score_away')::int;
    v_finalize := coalesce((v_item->>'finalize')::boolean, false);
    if v_score_home is null or v_score_away is null then continue; end if;

    v_ko_winner := null;
    if v_item->>'ko_winner_code' is not null then
      select t.id into v_ko_winner
      from public.teams t
      where t.tournament_id = v_match.tournament_id
        and t.code = v_item->>'ko_winner_code';
    end if;

    select (s.code = 'group') into v_is_group
    from public.stages s where s.id = v_match.stage_id;
    if v_finalize and not v_is_group and v_ko_winner is null then
      v_finalize := false;
    end if;

    if not v_finalize
       and v_match.score_home is not distinct from v_score_home
       and v_match.score_away is not distinct from v_score_away then
      continue;
    end if;

    update public.matches
    set score_home = v_score_home,
        score_away = v_score_away,
        ko_winner_team_id = coalesce(v_ko_winner, ko_winner_team_id),
        espn_event_id = coalesce(v_item->>'espn_event_id', espn_event_id),
        result_source = 'espn',
        status = case when v_finalize then 'finished' else status end,
        finalized_at = case when v_finalize then now() else finalized_at end
    where id = v_match.id
    returning * into v_after;
    v_updated := v_updated + 1;

    if v_finalize then
      insert into public.audit_log (
        actor_id, actor_role, action, target_table, target_id, reason,
        before_state, after_state
      ) values (
        auth.uid(), 'system', 'poll_results_espn', 'matches', v_match.id,
        'Resultado automatico desde ESPN',
        to_jsonb(v_match), to_jsonb(v_after)
      );
      perform public.calculate_match(v_match.id);
      perform public.advance_brackets(v_after.tournament_id);
      v_finalized := v_finalized + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'finalized', v_finalized);
end;
$$;

-- ============================================================================
-- 3) match_set_result: igual que 20260529080013, + advance_brackets al
--    finalizar (cubre el cierre manual del admin, ej. penales sin data ESPN).
-- ============================================================================
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
    perform public.advance_brackets(v_after.tournament_id);
  end if;
end;
$$;

-- ============================================================================
-- 4) Backfill: avanzar YA los 16avos que ya terminaron (abre los octavos
--    que tengan los dos cruces definidos).
-- ============================================================================
select public.advance_brackets('00000000-0000-0000-0000-00000000a001');
