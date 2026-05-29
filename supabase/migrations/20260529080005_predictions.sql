-- 0005_predictions.sql
-- Picks de los amigos: por partido (1X2 + exacto) y globales (campeon,
-- goleador, mvp, subcampeon, revelacion). Tambien la tabla append-only
-- de history para auditoria.

create table public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  predicted_winner text not null check (predicted_winner in ('home', 'draw', 'away')),
  predicted_home int not null check (predicted_home between 0 and 20),
  predicted_away int not null check (predicted_away between 0 and 20),
  predicted_ko_winner_team_id uuid references public.teams (id),
  is_auto_random boolean not null default false,
  state text not null default 'open'
    check (state in ('open', 'locked', 'scored', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,
  scored_at timestamptz,
  unique (user_id, match_id),
  constraint mp_winner_consistent_with_score check (
    (predicted_home > predicted_away and predicted_winner = 'home')
    or (predicted_home < predicted_away and predicted_winner = 'away')
    or (predicted_home = predicted_away and predicted_winner = 'draw')
  )
);

create index mp_user_idx on public.match_predictions (user_id);
create index mp_match_idx on public.match_predictions (match_id);
create index mp_state_idx on public.match_predictions (state);

create trigger mp_set_updated_at
  before update on public.match_predictions
  for each row execute function public.set_updated_at();

-- History append-only: cada UPDATE escribe la version vieja aca.
-- Sin policies de UPDATE/DELETE -> insert-only desde el trigger.
create table public.match_prediction_history (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null,
  user_id uuid not null,
  match_id uuid not null,
  predicted_winner text,
  predicted_home int,
  predicted_away int,
  predicted_ko_winner_team_id uuid,
  is_auto_random boolean,
  state text,
  edited_by uuid,
  edited_at timestamptz not null default now()
);

create index mph_prediction_idx on public.match_prediction_history (prediction_id);
create index mph_user_idx on public.match_prediction_history (user_id);

-- Globales: 5 categorias. champion/runner_up usan team_id. top_scorer/
-- mvp/revelation usan player_team_id + player_name (texto libre, admin
-- normaliza al final via resolve_global).
create table public.global_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category text not null check (category in (
    'champion', 'runner_up', 'top_scorer', 'mvp', 'revelation'
  )),
  team_id uuid references public.teams (id),
  player_team_id uuid references public.teams (id),
  player_name text,
  state text not null default 'open'
    check (state in ('open', 'locked', 'scored', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,
  scored_at timestamptz,
  unique (user_id, tournament_id, category),
  constraint gp_category_fields check (
    (category in ('champion', 'runner_up') and team_id is not null
      and player_team_id is null and player_name is null)
    or (category in ('top_scorer', 'mvp', 'revelation')
      and player_team_id is not null and player_name is not null
      and length(trim(player_name)) > 0
      and team_id is null)
  )
);

create index gp_user_idx on public.global_predictions (user_id);
create index gp_tournament_idx on public.global_predictions (tournament_id);

create trigger gp_set_updated_at
  before update on public.global_predictions
  for each row execute function public.set_updated_at();
