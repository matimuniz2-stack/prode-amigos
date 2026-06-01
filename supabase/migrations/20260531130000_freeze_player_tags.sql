-- 0028_freeze_player_tags.sql
-- Auditoría 2026-05-31 (hallazgo #3): la RLS opera por FILA, no por columna.
-- profiles_update_self solo congelaba `role`, así que un player podía hacer
-- update de sus propias `tags` desde el cliente del browser y coronarse solo
-- (visible en el ranking público). Fix: el self-update también debe dejar
-- `tags` igual. El admin no se ve afectado: usa profiles_admin_all (is_admin),
-- que es una policy permisiva aparte (se evalúan con OR).

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and tags = (select tags from public.profiles where id = auth.uid())
  );
