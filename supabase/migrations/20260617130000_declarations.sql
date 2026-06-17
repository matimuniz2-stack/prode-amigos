-- Conferencia de prensa: declaraciones post-fecha (una por jugador por fecha).
-- day_key = día ART, ej "2026-06-16". En la UI declaran el crack y el papelón
-- de la fecha, pero la tabla es genérica. Todos los logueados leen; cada uno
-- escribe/edita/borra solo la suya.
create table if not exists public.declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, day_key)
);

alter table public.declarations enable row level security;

drop policy if exists "declarations_read" on public.declarations;
create policy "declarations_read" on public.declarations
  for select to authenticated using (true);

drop policy if exists "declarations_write_own" on public.declarations;
create policy "declarations_write_own" on public.declarations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
