-- 0011_triggers_enforce_lock.sql
-- Defensa de paranoia sobre la RLS: trigger BEFORE INSERT/UPDATE en
-- match_predictions que vuelve a verificar el lock y escribe la version
-- vieja en match_prediction_history. Si la RLS fallara (bug, role mal,
-- service_role mal usado), este trigger sigue cerrando la puerta.

create or replace function public.enforce_prediction_lock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_lock_at timestamptz;
  v_match_status text;
begin
  select m.lock_at, m.status into v_lock_at, v_match_status
  from public.matches m
  where m.id = new.match_id;

  if v_lock_at is null then
    raise exception 'Match % no existe', new.match_id using errcode = 'P0002';
  end if;

  if v_match_status in ('void', 'cancelled') then
    raise exception 'Match % esta % - no se pueden cargar picks', new.match_id, v_match_status
      using errcode = 'P0001';
  end if;

  -- Permitimos al cron crear picks auto-random justo en el lock_at
  -- (cron corre cada 60s, puede llegar +/- 1min del kickoff).
  if new.is_auto_random then
    if v_lock_at < now() - interval '5 minutes' then
      raise exception 'Auto-random fuera de ventana: lock_at=%, now=%', v_lock_at, now()
        using errcode = 'P0001';
    end if;
  else
    if v_lock_at <= now() then
      raise exception 'Pick bloqueado: el partido ya empezo (lock_at=%, now=%)', v_lock_at, now()
        using errcode = 'P0001';
    end if;
  end if;

  -- Auditoria automatica de cada UPDATE
  if tg_op = 'UPDATE' then
    insert into public.match_prediction_history (
      prediction_id, user_id, match_id,
      predicted_winner, predicted_home, predicted_away,
      predicted_ko_winner_team_id, is_auto_random, state, edited_by
    ) values (
      old.id, old.user_id, old.match_id,
      old.predicted_winner, old.predicted_home, old.predicted_away,
      old.predicted_ko_winner_team_id, old.is_auto_random, old.state, auth.uid()
    );
  end if;

  return new;
end;
$$;

create trigger mp_enforce_lock
  before insert or update on public.match_predictions
  for each row execute function public.enforce_prediction_lock();

-- Trigger gemelo para globales: bloquea ediciones despues de
-- tournaments.globals_lock_at.
create or replace function public.enforce_global_lock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_lock_at timestamptz;
begin
  select t.globals_lock_at into v_lock_at
  from public.tournaments t
  where t.id = new.tournament_id;

  if v_lock_at is null then
    raise exception 'Tournament % no existe', new.tournament_id using errcode = 'P0002';
  end if;

  if v_lock_at <= now() then
    raise exception 'Globales bloqueadas (lock_at=%, now=%)', v_lock_at, now()
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger gp_enforce_lock
  before insert or update on public.global_predictions
  for each row execute function public.enforce_global_lock();
