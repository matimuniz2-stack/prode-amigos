-- 0002_profiles.sql
-- profiles extiende auth.users con nickname unico, avatar y rol.
-- Trigger handle_new_user inserta una fila al hacer sign-up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nickname text not null unique,
  avatar_url text,
  role text not null default 'player'
    check (role in ('player', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- Trigger para updated_at automatico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-crear profile al hacer sign-up.
-- Para Google OAuth: usa el email como nickname inicial (parte antes del @) y
-- lo deja editable. El owner se setea por el seed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_nickname text;
  candidate text;
  suffix int := 0;
begin
  base_nickname := lower(split_part(new.email, '@', 1));
  candidate := base_nickname;
  while exists (select 1 from public.profiles where nickname = candidate) loop
    suffix := suffix + 1;
    candidate := base_nickname || suffix::text;
  end loop;

  insert into public.profiles (id, email, nickname)
  values (new.id, new.email, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
