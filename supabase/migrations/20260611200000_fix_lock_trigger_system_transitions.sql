-- 20260611200000_fix_lock_trigger_system_transitions.sql
-- BUG CRÍTICO (encontrado el día 1 del Mundial): enforce_prediction_lock
-- bloqueaba TODOS los updates post-lock, incluidos los del propio sistema:
--   * lock_due_predictions (cron): open -> locked al kickoff
--   * calculate_match (scoring): locked -> scored al finalizar
-- El cron moría con "Pick bloqueado" en el paso 1, así que nunca llegaba a
-- pasar los partidos a live ni a crear auto-randoms (México-Sudáfrica quedó
-- 'scheduled' en la DB con el partido ya terminado).
--
-- Fix: si el UPDATE no cambia el contenido del pick (ganador, goles, KO,
-- auto-random, dueño) y solo avanza el estado a locked/scored, es una
-- transición de sistema y pasa sin chequear el lock (y sin escribir
-- history, que para esas transiciones es ruido).

create or replace function public.enforce_prediction_lock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_lock_at timestamptz;
  v_match_status text;
  v_system_transition boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_system_transition :=
      new.user_id = old.user_id
      and new.match_id = old.match_id
      and new.predicted_winner is not distinct from old.predicted_winner
      and new.predicted_home is not distinct from old.predicted_home
      and new.predicted_away is not distinct from old.predicted_away
      and new.predicted_ko_winner_team_id is not distinct from old.predicted_ko_winner_team_id
      and new.is_auto_random = old.is_auto_random
      and new.state in ('locked', 'scored');
    if v_system_transition then
      return new;
    end if;
  end if;

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

  -- Auditoria automatica de cada UPDATE con cambios reales
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
