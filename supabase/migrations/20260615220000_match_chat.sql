-- 20260615220000_match_chat.sql
-- Chat por partido (post-lock). Se habla SOLO una vez cerrado el partido,
-- coherente con la privacidad de picks (antes del lock nadie ve ni comenta).
-- Tabla aislada: no toca scoring/picks/resultados.

create table public.match_chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index match_chat_match_idx on public.match_chat_messages (match_id, created_at);

alter table public.match_chat_messages enable row level security;

-- Helper: el partido ya está cerrado (lock pasado) y no anulado.
-- Reusa el mismo criterio que la visibilidad de picks.
create or replace function public.is_match_chat_open(p_match_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.lock_at <= now()
      and m.status not in ('pending_bracket', 'cancelled', 'void', 'postponed')
  );
$$;

-- Lectura: solo mensajes de partidos ya cerrados (o admin).
create policy mcc_read on public.match_chat_messages
  for select using (
    public.is_match_chat_open(match_id) or public.is_admin()
  );

-- Insert: uno mismo, en un partido cerrado.
create policy mcc_insert on public.match_chat_messages
  for insert with check (
    user_id = auth.uid()
    and public.is_match_chat_open(match_id)
  );

-- Sin update (los mensajes no se editan).
-- Delete: solo el admin (moderación).
create policy mcc_admin_delete on public.match_chat_messages
  for delete using (public.is_admin());

grant select, insert, delete on public.match_chat_messages to authenticated;
