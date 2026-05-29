-- 0003_tournaments_stages_groups_teams.sql
-- Las dimensiones del Mundial 2026: torneo, etapas (group/r32/.../final),
-- los 12 grupos A-L y las 48 selecciones.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  globals_lock_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'registration', 'locked', 'live', 'finished')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  code text not null check (code in ('group', 'r32', 'r16', 'qf', 'sf', 'tp', 'final')),
  name text not null,
  scoring_profile text not null,
  order_idx int not null,
  unique (tournament_id, code)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  code text not null check (code ~ '^[A-L]$'),
  unique (tournament_id, code)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  code text not null,
  name text not null,
  flag_emoji text,
  seed_pot int,
  unique (tournament_id, code)
);

create index teams_group_idx on public.teams (group_id);
