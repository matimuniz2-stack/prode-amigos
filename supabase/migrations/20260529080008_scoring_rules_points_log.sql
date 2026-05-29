-- 0008_scoring_rules_points_log.sql
-- Reglas de puntaje versionables (columnas active_from/active_to/version
-- listas pero MVP siempre lee la fila vigente, sin versionado real).
-- points_log idempotente por UNIQUE(user_id, source_kind, source_id) para
-- que recalc no duplique puntos.

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  rule_key text not null,
  scope_stage text,
  points int not null,
  params jsonb not null default '{}'::jsonb,
  active_from timestamptz not null default now(),
  active_to timestamptz,
  version int not null default 1,
  unique (tournament_id, rule_key, scope_stage, version)
);

create index scoring_rules_lookup_idx
  on public.scoring_rules (tournament_id, rule_key, scope_stage)
  where active_to is null;

create table public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  source_kind text not null check (source_kind in (
    'match', 'global', 'bonus', 'adjustment'
  )),
  source_id uuid not null,
  rule_key text not null,
  scope_stage text,
  points int not null,
  breakdown jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  unique (user_id, source_kind, source_id, rule_key)
);

create index points_log_user_idx on public.points_log (user_id);
create index points_log_tournament_idx on public.points_log (tournament_id);
create index points_log_source_idx on public.points_log (source_kind, source_id);
