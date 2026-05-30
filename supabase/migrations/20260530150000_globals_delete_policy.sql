-- 0023_globals_delete_policy.sql
-- BUG (auditoría): en globales, vaciar una categoría y guardar dejaba la
-- apuesta vieja (el upsert no borra ausentes), y no había policy de DELETE,
-- así que el usuario no podía "des-apostar" una categoría → apuesta fantasma.
-- Fix: permitir al dueño borrar su global mientras no haya cerrado el deadline.
-- (El borrado no pasa por enforce_global_lock — que es BEFORE INSERT/UPDATE —
-- por eso la condición de lock va en la policy.)

create policy gp_delete on public.global_predictions
  for delete using (
    user_id = auth.uid()
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.globals_lock_at > now()
    )
  );
