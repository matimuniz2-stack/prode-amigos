-- 0004_matches.sql
-- 104 partidos del torneo. Los KO empiezan con home/away NULL +
-- placeholders ('W-A', '2nd-D') y status='pending_bracket' hasta que el
-- admin corre resolve_ko_round.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage_id uuid not null references public.stages (id),
  group_id uuid references public.groups (id),
  match_number int not null,
  home_team_id uuid references public.teams (id),
  away_team_id uuid references public.teams (id),
  home_placeholder text,
  away_placeholder text,
  kickoff_at timestamptz not null,
  lock_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in (
      'scheduled', 'pending_bracket', 'live', 'finished',
      'postponed', 'cancelled', 'void'
    )),
  score_home int check (score_home is null or score_home between 0 and 30),
  score_away int check (score_away is null or score_away between 0 and 30),
  ko_winner_team_id uuid references public.teams (id),
  external_api_id text,
  espn_event_id text,
  result_source text,
  venue text,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, match_number),
  constraint matches_teams_or_placeholders check (
    (home_team_id is not null and away_team_id is not null)
    or (home_placeholder is not null and away_placeholder is not null)
  )
);

create index matches_tournament_idx on public.matches (tournament_id);
create index matches_kickoff_idx on public.matches (kickoff_at);
create index matches_status_idx on public.matches (status);
create index matches_stage_idx on public.matches (stage_id);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();
