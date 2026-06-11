-- 20260611210000_whitelist_login.sql
-- Login cerrado al grupo de amigos. El OAuth de Google quedó publicado
-- (cualquiera con el link podía crearse cuenta y meterse al prode con
-- plata en juego — pasó con un desconocido el día 1, fue baneado).
--
-- Enforcement a nivel DB: trigger BEFORE INSERT en auth.users que rechaza
-- cualquier alta cuyo email no esté en public.allowed_emails. Los usuarios
-- existentes no se ven afectados (el login de una cuenta existente no
-- inserta en auth.users). Bloquea también a quien use la anon key directo,
-- sin pasar por la app.
--
-- PASO MANUAL EN PROD (no va en el repo, son datos personales):
--   insert into public.allowed_emails (email) values ('amigo1@gmail.com'), ...;

create table if not exists public.allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
-- Sin policies: la tabla no es accesible via API (ni lectura). Se gestiona
-- por SQL editor; el trigger la lee con SECURITY DEFINER.
revoke all on table public.allowed_emails from anon, authenticated;

create or replace function public.enforce_allowed_emails()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_emails ae
    where lower(ae.email) = lower(new.email)
  ) then
    raise exception 'Login cerrado: % no esta invitado al prode', coalesce(new.email, '(sin email)')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_allowed_emails() from public;

drop trigger if exists users_enforce_allowed_emails on auth.users;
create trigger users_enforce_allowed_emails
  before insert on auth.users
  for each row execute function public.enforce_allowed_emails();
