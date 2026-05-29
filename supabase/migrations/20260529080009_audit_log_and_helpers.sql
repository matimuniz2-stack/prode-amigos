-- 0009_audit_log_and_helpers.sql
-- audit_log para mutaciones de admin (RPC siempre escribe aca con
-- reason NOT NULL). Tambien helpers is_admin() y is_match_visible() que
-- las policies de la 0010 van a usar.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  actor_role text,
  action text not null,
  target_table text,
  target_id uuid,
  reason text not null check (length(trim(reason)) >= 3),
  before_state jsonb,
  after_state jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_action_idx on public.audit_log (action);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

-- Helpers para RLS y RPCs

-- Devuelve true si el usuario actual tiene role admin u owner.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner')
  );
$$;

-- Devuelve true cuando el match ya cerro (lock_at <= now()), o sea
-- cuando los picks ajenos pasan a ser visibles para todos.
create or replace function public.is_match_visible(p_match_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.lock_at <= now()
  );
$$;
