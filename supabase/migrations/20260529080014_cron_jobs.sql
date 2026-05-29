-- 0014_cron_jobs.sql
-- pg_cron jobs:
--   * prediction_lock: cada 1 min, lockea picks y crea auto-random para
--     users que no cargaron antes del kickoff.
--   * mark_live_matches: cada 1 min, transiciona scheduled -> live.
-- El polling de resultados desde APIs lo hace una Vercel Cron Function
-- (no pg_cron) porque pg_net es engorroso para 1 req/min.

create or replace function public.lock_due_predictions()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_user record;
  v_total int := 0;
  v_home int;
  v_away int;
begin
  -- 1. Lockear picks existentes en partidos que cruzaron lock_at
  update public.match_predictions mp
  set state = 'locked', locked_at = now()
  from public.matches m
  where m.id = mp.match_id
    and m.lock_at <= now()
    and mp.state = 'open';
  get diagnostics v_total = row_count;

  -- 2. Para cada partido con kickoff pasado: crear placeholder
  --    is_auto_random para los users sin pick
  for v_match in
    select m.id as match_id, m.tournament_id
    from public.matches m
    where m.lock_at <= now()
      and m.lock_at > now() - interval '5 minutes'
      and m.status = 'scheduled'
  loop
    for v_user in
      select p.id as user_id
      from public.profiles p
      where not exists (
        select 1 from public.match_predictions mp
        where mp.user_id = p.id and mp.match_id = v_match.match_id
      )
    loop
      v_home := floor(random() * 4)::int;
      v_away := floor(random() * 4)::int;
      insert into public.match_predictions (
        user_id, match_id,
        predicted_winner, predicted_home, predicted_away,
        is_auto_random, state, locked_at
      ) values (
        v_user.user_id, v_match.match_id,
        case
          when v_home > v_away then 'home'
          when v_home < v_away then 'away'
          else 'draw'
        end,
        v_home, v_away,
        true, 'locked', now()
      ) on conflict (user_id, match_id) do nothing;
    end loop;
  end loop;

  -- 3. Status de match: scheduled -> live cuando cruza kickoff
  update public.matches
  set status = 'live'
  where status = 'scheduled' and kickoff_at <= now();

  return v_total;
end;
$$;

select cron.schedule(
  'lock_due_predictions',
  '* * * * *',
  $$ select public.lock_due_predictions() $$
);
