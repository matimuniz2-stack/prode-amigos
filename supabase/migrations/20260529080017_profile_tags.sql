-- 0017_profile_tags.sql
-- Etiquetas que el admin le pone a cada participante (ej. "🤡 Mufa",
-- "🧠 El sabio"). Se muestran junto al nombre en el ranking. El admin las
-- edita desde /admin/participants; los players no las tocan (RLS:
-- profiles_admin_all permite el update solo a admin/owner).
alter table public.profiles
  add column if not exists tags text[] not null default '{}';
