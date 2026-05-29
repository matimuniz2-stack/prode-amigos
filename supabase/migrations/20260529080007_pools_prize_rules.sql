-- 0007_pools_prize_rules.sql
-- Pozo simplificado segun PASO 0: SIN pool_contributions, los pagos se
-- gestionan afuera de la app. Solo total_amount editable por admin para
-- que el ranking muestre projected_prize.

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  total_amount numeric(12, 2) not null default 0,
  currency text not null default 'ARS' check (length(currency) = 3),
  status text not null default 'open'
    check (status in ('open', 'closed', 'paid_out')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id)
);

create trigger pools_set_updated_at
  before update on public.pools
  for each row execute function public.set_updated_at();

-- Reglas de reparto: defaults 60/25/15 al 1ro/2do/3ro pero editables
-- por el admin pre-torneo.
create table public.prize_rules (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  rule_key text not null check (rule_key in (
    'overall_1st', 'overall_2nd', 'overall_3rd', 'best_round'
  )),
  share_pct numeric(5, 2) check (share_pct is null or share_pct between 0 and 100),
  fixed_amount numeric(12, 2),
  description text,
  unique (pool_id, rule_key),
  constraint prize_share_or_fixed check (
    (share_pct is not null and fixed_amount is null)
    or (share_pct is null and fixed_amount is not null)
  )
);
