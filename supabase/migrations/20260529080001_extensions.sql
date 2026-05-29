-- 0001_extensions.sql
-- Habilita las extensiones de Postgres que el resto del schema asume.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
