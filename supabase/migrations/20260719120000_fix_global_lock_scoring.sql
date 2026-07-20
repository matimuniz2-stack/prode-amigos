-- Fix: enforce_global_lock bloqueaba TODO update post-lock, incluso el que
-- hace resolve_global para marcar state='scored'. O sea: nunca se podian
-- resolver las globales (siempre se resuelven despues del lock).
-- Ahora se permite el update cuando el pick en si no cambia (solo cambian
-- state/scored_at, la transicion de scoring). Ediciones reales del pick
-- siguen bloqueadas post-lock, y los inserts tambien.
create or replace function public.enforce_global_lock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_lock_at timestamptz;
begin
  if tg_op = 'UPDATE'
    and new.user_id is not distinct from old.user_id
    and new.tournament_id is not distinct from old.tournament_id
    and new.category is not distinct from old.category
    and new.team_id is not distinct from old.team_id
    and new.player_team_id is not distinct from old.player_team_id
    and new.player_name is not distinct from old.player_name
  then
    return new;
  end if;

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
