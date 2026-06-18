-- Push notifications (Web Push): una suscripción por dispositivo de cada
-- jugador. El envío (server/cron) usa el service-role (bypassa RLS); el cliente
-- solo gestiona LAS SUYAS.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on public.push_subscriptions;
create policy "push_subs_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_subs_write_own" on public.push_subscriptions;
create policy "push_subs_write_own" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
