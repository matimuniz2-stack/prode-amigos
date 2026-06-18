-- Agendado del recordatorio pre-cierre por push. pg_cron corre
-- invoke_push_reminders() cada 15 min; si hay algún partido que cierra en ~1h,
-- pega (via pg_net) a /api/cron/push-reminders en Vercel con el secret del Vault
-- como Bearer. La ruta busca quién no cargó el pick y manda el push.
--
-- ⚠️ ANTES de correr esto, creá el secret en el Vault con el MISMO valor que la
-- env var CRON_SECRET de Vercel:
--   select vault.create_secret('<MISMO_VALOR_QUE_CRON_SECRET>', 'push_reminders_secret');
-- ----------------------------------------------------------------------------
create or replace function public.invoke_push_reminders()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text;
begin
  -- Solo despertamos a Vercel si hay algún partido que cierra en ~1h.
  if not exists (
    select 1 from public.matches
    where status = 'scheduled'
      and lock_at > now() + interval '45 minutes'
      and lock_at <= now() + interval '70 minutes'
  ) then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_reminders_secret';
  if v_secret is null then
    return;
  end if;

  perform net.http_get(
    url := 'https://www.prodelospibes.com/api/cron/push-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.invoke_push_reminders() from public;

select cron.schedule(
  'push_reminders',
  '*/15 * * * *',
  $$ select public.invoke_push_reminders() $$
);
