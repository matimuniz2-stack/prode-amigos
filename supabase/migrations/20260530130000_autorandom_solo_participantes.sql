-- 0021_autorandom_solo_participantes.sql
-- BUG (auditoría): lock_due_predictions creaba un pick auto-random para CADA
-- perfil registrado (todo public.profiles), metiendo al leaderboard a cualquiera
-- que se logueó una vez y nunca jugó (incluido el owner/admin). Con plata real
-- eso falsea el padrón y el pozo.
--
-- Fix: definir "participante" de forma implícita = quien cargó al menos UN
-- pronóstico REAL (pick de partido no auto-random, o un global) en el torneo.
-- El cron solo le pone auto-random a los participantes que no cargaron ESE
-- partido. Quien nunca cargó nada no juega (no recibe picks ni aparece con
-- puntos). NO toca el resto del comportamiento (lock + scheduled->live).

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
  -- 1. Lockear picks abiertos cuyo partido cruzó lock_at
  update public.match_predictions mp
  set state = 'locked', locked_at = now()
  from public.matches m
  where m.id = mp.match_id
    and m.lock_at <= now()
    and mp.state = 'open';
  get diagnostics v_total = row_count;

  -- 2. Auto-random SOLO para PARTICIPANTES (cargaron >=1 pronóstico real o
  --    global en el torneo) que no cargaron este partido.
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
      and exists (
        select 1 from public.match_predictions mp2
        join public.matches m2 on m2.id = mp2.match_id
        where mp2.user_id = p.id
          and m2.tournament_id = v_match.tournament_id
          and mp2.is_auto_random = false
        union
        select 1 from public.global_predictions gp
        where gp.user_id = p.id and gp.tournament_id = v_match.tournament_id
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

  -- 3. scheduled -> live al cruzar kickoff
  update public.matches
  set status = 'live'
  where status = 'scheduled' and kickoff_at <= now();

  return v_total;
end;
$$;
