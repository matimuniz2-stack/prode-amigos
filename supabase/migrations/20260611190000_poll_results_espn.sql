-- 20260611190000_poll_results_espn.sql
-- Fase 6: resultados automáticos desde ESPN.
--
-- Flujo: pg_cron corre invoke_poll_results() cada 1 min; si hay partidos
-- en vivo, pega (via pg_net) a /api/cron/poll-results en Vercel con el
-- secret del Vault como Bearer. La ruta lee el scoreboard de ESPN y llama
-- poll_results_candidates / poll_results_apply (que re-validan el secret).
--
-- PASO MANUAL EN PROD (una sola vez, NO va en el repo):
--   select vault.create_secret('<SECRET_LARGO_RANDOM>', 'poll_results_secret');
-- Sin ese secret el cron no llama a nadie y las RPCs solo aceptan admins.

create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- poll_check_access(secret): pasa si el secret coincide con el Vault o si el
-- caller es admin (para el botón manual del panel).
-- ----------------------------------------------------------------------------
create or replace function public.poll_check_access(p_secret text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'poll_results_secret';

  if v_secret is not null
     and p_secret is not null
     and length(p_secret) > 0
     and p_secret = v_secret then
    return;
  end if;
  if public.is_admin() then
    return;
  end if;
  raise exception 'No autorizado' using errcode = '42501';
end;
$$;

revoke all on function public.poll_check_access(text) from public;

-- ----------------------------------------------------------------------------
-- poll_results_candidates(secret): partidos en vivo que el poller puede tocar.
-- Excluye los que el admin cargó a mano (result_source = 'manual').
-- ----------------------------------------------------------------------------
create or replace function public.poll_results_candidates(p_secret text)
returns table (
  id uuid,
  espn_event_id text,
  home_code text,
  away_code text,
  kickoff_at timestamptz,
  stage_code text
)
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.poll_check_access(p_secret);
  return query
    select m.id, m.espn_event_id, ht.code, at_.code, m.kickoff_at, s.code
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at_ on at_.id = m.away_team_id
    join public.stages s on s.id = m.stage_id
    where m.status = 'live'
      and (m.result_source is null or m.result_source = 'espn');
end;
$$;

grant execute on function public.poll_results_candidates(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- poll_results_apply(secret, updates): aplica scores en vivo y finaliza.
-- updates = [{match_id, espn_event_id, score_home, score_away, finalize,
--             ko_winner_code}].
-- Al finalizar: audita (actor system) y dispara calculate_match (puntúa).
-- Nunca pisa partidos finished ni con result_source manual.
-- ----------------------------------------------------------------------------
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

    -- En KO no se finaliza sin ganador resuelto (lo cierra el admin).
    select (s.code = 'group') into v_is_group
    from public.stages s where s.id = v_match.stage_id;
    if v_finalize and not v_is_group and v_ko_winner is null then
      v_finalize := false;
    end if;

    -- Sin cambios -> no tocar (evita un update + audit por minuto).
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
        'Resultado automático desde ESPN',
        to_jsonb(v_match), to_jsonb(v_after)
      );
      perform public.calculate_match(v_match.id);
      v_finalized := v_finalized + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'finalized', v_finalized);
end;
$$;

grant execute on function public.poll_results_apply(text, jsonb) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- invoke_poll_results(): la llama pg_cron cada minuto. Solo hace el HTTP si
-- hay partidos en vivo y el secret existe en el Vault.
-- ----------------------------------------------------------------------------
create or replace function public.invoke_poll_results()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text;
begin
  if not exists (select 1 from public.matches where status = 'live') then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'poll_results_secret';
  if v_secret is null then
    return;
  end if;

  perform net.http_get(
    url := 'https://www.prodelospibes.com/api/cron/poll-results',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 8000
  );
end;
$$;

revoke all on function public.invoke_poll_results() from public;

select cron.schedule(
  'poll_results_espn',
  '* * * * *',
  $$ select public.invoke_poll_results() $$
);
