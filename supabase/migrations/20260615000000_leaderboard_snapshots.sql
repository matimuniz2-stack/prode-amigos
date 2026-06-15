-- 20260615000000_leaderboard_snapshots.sql
-- Fotos diarias del ranking para mostrar el movimiento ▲▼ en el leaderboard.
-- Un pg_cron diario guarda la posicion (rank + puntos) de cada jugador. La UI
-- compara el rank actual (live) contra la foto mas reciente => "como te movio
-- la ultima fecha". Mismo patron security-definer + cron que lock_due_predictions.

create table public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  snapshot_date date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank int not null,
  total_points int not null,
  captured_at timestamptz not null default now(),
  unique (tournament_id, snapshot_date, user_id)
);

create index leaderboard_snapshots_lookup_idx
  on public.leaderboard_snapshots (tournament_id, snapshot_date desc);

alter table public.leaderboard_snapshots enable row level security;

-- Lectura publica (es la misma info que ya muestra el ranking).
create policy ls_read on public.leaderboard_snapshots
  for select using (true);

-- Solo el admin puede tocar a mano; el cron escribe via security definer.
create policy ls_admin on public.leaderboard_snapshots
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.leaderboard_snapshots to anon, authenticated;

-- ============================================================================
-- Captura de la foto del dia (idempotente: si corre 2 veces el mismo dia,
-- pisa la fila de ese dia con el valor mas nuevo).
-- ============================================================================
create or replace function public.capture_leaderboard_snapshot()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int := 0;
begin
  insert into public.leaderboard_snapshots
    (tournament_id, snapshot_date, user_id, rank, total_points)
  select
    lp.tournament_id,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    lp.user_id,
    lp.rank,
    lp.total_points
  from public.leaderboard_projection lp
  on conflict (tournament_id, snapshot_date, user_id)
  do update set
    rank = excluded.rank,
    total_points = excluded.total_points,
    captured_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Diario 06:00 UTC = 03:00 ART (despues de los partidos de la jornada).
select cron.schedule(
  'capture_leaderboard_snapshot',
  '0 6 * * *',
  $$ select public.capture_leaderboard_snapshot() $$
);

-- Backfill: foto inicial de hoy para tener baseline desde ya.
select public.capture_leaderboard_snapshot();
