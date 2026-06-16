-- 20260615240000_global_predictions_random.sql
-- Marca de "pick automático/random" en los globales, análoga a
-- match_predictions.is_auto_random. Se usa para avisar en la UI (🎲) cuando
-- al jugador que no cargó se le completó un global random "consciente".
alter table public.global_predictions
  add column if not exists is_auto_random boolean not null default false;
