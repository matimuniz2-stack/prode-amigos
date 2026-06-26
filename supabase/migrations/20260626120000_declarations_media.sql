-- Declaraciones multimedia: además de texto, el crack/papelón puede dejar un
-- audio (nota de voz) o una foto. Idempotente: crea la tabla si no existe
-- (la migración original puede no haberse aplicado en prod) y le agrega las
-- columnas nuevas. `text` pasa a ser opcional (audio/foto pueden ir sin texto).

create table if not exists public.declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null,
  text text,
  created_at timestamptz not null default now(),
  unique (user_id, day_key)
);

-- kind: 'text' | 'audio' | 'photo'. media_url apunta al bucket 'declarations'.
alter table public.declarations
  add column if not exists kind text not null default 'text';
alter table public.declarations
  add column if not exists media_url text;

-- text deja de ser obligatorio (audio/foto pueden no tener caption).
alter table public.declarations alter column text drop not null;

-- Validación de kind (drop+add para que sea idempotente).
alter table public.declarations drop constraint if exists declarations_kind_check;
alter table public.declarations
  add constraint declarations_kind_check
  check (kind in ('text', 'audio', 'photo'));

alter table public.declarations enable row level security;

drop policy if exists "declarations_read" on public.declarations;
create policy "declarations_read" on public.declarations
  for select to authenticated using (true);

drop policy if exists "declarations_write_own" on public.declarations;
create policy "declarations_write_own" on public.declarations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Bucket público para audios/fotos de declaraciones. Cada jugador escribe SOLO
-- en su carpeta ("<uid>/..."). Lectura pública para <img>/<audio>.
insert into storage.buckets (id, name, public)
values ('declarations', 'declarations', true)
on conflict (id) do nothing;

drop policy if exists "declarations_media_read" on storage.objects;
create policy "declarations_media_read" on storage.objects
  for select using (bucket_id = 'declarations');

drop policy if exists "declarations_media_insert_own" on storage.objects;
create policy "declarations_media_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'declarations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "declarations_media_update_own" on storage.objects;
create policy "declarations_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'declarations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "declarations_media_delete_own" on storage.objects;
create policy "declarations_media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'declarations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
