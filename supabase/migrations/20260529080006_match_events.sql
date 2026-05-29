-- 0006_match_events.sql
-- Timeline live del partido: goles, tarjetas, cambios, penales, var.
-- Idempotente por external_event_id para que el cron pueda reintroducir
-- la misma respuesta de la API sin duplicar eventos.

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  kind text not null check (kind in (
    'goal', 'yellow_card', 'red_card', 'substitution',
    'penalty', 'own_goal', 'var'
  )),
  minute int check (minute is null or minute between 0 and 130),
  team_id uuid references public.teams (id),
  player_name text,
  detail jsonb not null default '{}'::jsonb,
  external_event_id text,
  occurred_at timestamptz not null default now(),
  unique (match_id, external_event_id)
);

create index match_events_match_idx on public.match_events (match_id);
create index match_events_kind_idx on public.match_events (kind);
