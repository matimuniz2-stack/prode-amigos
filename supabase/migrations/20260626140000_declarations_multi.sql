-- Declaraciones combinadas: una declaración puede tener foto + audio + texto
-- al mismo tiempo (apiladas), no un solo tipo. Agregamos columnas dedicadas y
-- migramos lo que hubiera en el viejo media_url/kind. text ya era nullable.

alter table public.declarations add column if not exists audio_url text;
alter table public.declarations add column if not exists photo_url text;

-- Migrar datos viejos (si los hubiera) del esquema kind/media_url.
update public.declarations
  set audio_url = media_url
  where kind = 'audio' and media_url is not null and audio_url is null;
update public.declarations
  set photo_url = media_url
  where kind = 'photo' and media_url is not null and photo_url is null;
