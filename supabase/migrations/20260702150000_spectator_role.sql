-- 20260702150000_spectator_role.sql
-- Modo espectador: gente whitelisteada que entra a MIRAR pero no juega.
-- Caso concreto: un conocido programador quiere ver cómo funciona el prode.
--
-- Reglas:
--   - profiles.role admite 'spectator'.
--   - allowed_emails.role define con qué rol nace la cuenta (handle_new_user
--     lo lee al crear el profile). Default 'player': los amigos no cambian.
--   - El espectador queda FUERA del ranking: la view leaderboard filtra por
--     rol, y leaderboard_projection + los snapshots diarios derivan de ella,
--     así que premios, descenso y el movimiento ▲▼ tampoco lo ven.
--   - No puede cargar picks de partido ni globales (enforcement por RLS,
--     igual que la whitelist). Lo social (chat, reacciones, declaraciones)
--     queda abierto.
--
-- PASO MANUAL EN PROD (datos personales, no van al repo):
--   update public.allowed_emails set role = 'spectator' where email = '...';

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('player', 'admin', 'owner', 'spectator'));

alter table public.allowed_emails
  add column if not exists role text not null default 'player'
    check (role in ('player', 'spectator'));

-- El signup toma el rol de la whitelist (si no hay fila, 'player': el trigger
-- de whitelist ya rechazó ese caso antes, esto es solo red de seguridad).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_nickname text;
  candidate text;
  suffix int := 0;
  v_role text;
begin
  base_nickname := lower(split_part(new.email, '@', 1));
  candidate := base_nickname;
  while exists (select 1 from public.profiles where nickname = candidate) loop
    suffix := suffix + 1;
    candidate := base_nickname || suffix::text;
  end loop;

  select ae.role into v_role
  from public.allowed_emails ae
  where lower(ae.email) = lower(new.email);

  insert into public.profiles (id, email, nickname, role)
  values (new.id, new.email, candidate, coalesce(v_role, 'player'));
  return new;
end;
$$;

-- Espejo de is_admin(), para usar en policies.
create or replace function public.is_spectator()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'spectator'
  );
$$;

-- Fuera del ranking. Misma view de 20260611220000, solo se agrega el filtro
-- por rol (mismas columnas, create or replace no rompe la projection).
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
  where p.role <> 'spectator'
  group by t.id, p.id, p.nickname, p.avatar_url;

-- RLS: el espectador no escribe picks. Mismas policies de 20260529080010,
-- con "not is_spectator()" agregado. No se toca gp_delete/lecturas: sin
-- filas propias no hay nada que borrar, y ver puede ver todo.

drop policy mp_insert on public.match_predictions;
create policy mp_insert on public.match_predictions
  for insert with check (
    user_id = auth.uid()
    and not public.is_spectator()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lock_at > now()
    )
  );

drop policy mp_update on public.match_predictions;
create policy mp_update on public.match_predictions
  for update using (
    user_id = auth.uid()
    and not public.is_spectator()
    and state = 'open'
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lock_at > now()
    )
  ) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lock_at > now()
    )
  );

drop policy gp_insert on public.global_predictions;
create policy gp_insert on public.global_predictions
  for insert with check (
    user_id = auth.uid()
    and not public.is_spectator()
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.globals_lock_at > now()
    )
  );

drop policy gp_update on public.global_predictions;
create policy gp_update on public.global_predictions
  for update using (
    user_id = auth.uid()
    and not public.is_spectator()
    and state = 'open'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.globals_lock_at > now()
    )
  ) with check (user_id = auth.uid());
