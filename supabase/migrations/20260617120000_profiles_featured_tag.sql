-- Insignia destacada: el tag que el jugador elige chapear junto a su nombre en
-- todo el prode. Guarda el string completo del tag (emoji incluido, ej.
-- "🐐 El GOAT"), igual que profiles.tags. NULL = sin destacada.
alter table public.profiles
  add column if not exists featured_tag text;
