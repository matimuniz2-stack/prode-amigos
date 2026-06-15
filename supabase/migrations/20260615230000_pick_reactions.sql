-- 20260615230000_pick_reactions.sql
-- Reacciones con emojis a los picks de los DEMÁS (chicana post-lock).
-- Solo se reacciona una vez cerrado el partido (mismo criterio que el chat y
-- la visibilidad de picks). No se puede reaccionar al pick propio.
-- Tabla aislada: no toca scoring/picks/resultados.

create table public.pick_reactions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reactor_user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '🤡', '😂', '💩', '🐐', '🎯')),
  created_at timestamptz not null default now(),
  unique (match_id, target_user_id, reactor_user_id, emoji),
  constraint pr_no_self check (target_user_id <> reactor_user_id)
);

create index pick_reactions_match_idx on public.pick_reactions (match_id);

alter table public.pick_reactions enable row level security;

-- Lectura: solo en partidos ya cerrados (reusa el helper del chat) o admin.
create policy pr_read on public.pick_reactions
  for select using (
    public.is_match_chat_open(match_id) or public.is_admin()
  );

-- Insert: uno mismo reaccionando a OTRO, en un partido cerrado.
create policy pr_insert on public.pick_reactions
  for insert with check (
    reactor_user_id = auth.uid()
    and target_user_id <> auth.uid()
    and public.is_match_chat_open(match_id)
  );

-- Delete: sacar la propia reacción (toggle) o moderación admin.
create policy pr_delete on public.pick_reactions
  for delete using (
    reactor_user_id = auth.uid() or public.is_admin()
  );

grant select, insert, delete on public.pick_reactions to authenticated;
