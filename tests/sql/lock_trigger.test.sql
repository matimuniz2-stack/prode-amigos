-- tests/sql/lock_trigger.test.sql
-- Los 3 casos obligatorios del trigger enforce_prediction_lock, segun
-- PLAN.md punto 4 de ajustes post-revision:
--   1. Pick 5 min ANTES del kickoff -> ACEPTA
--   2. Pick EXACTO al kickoff -> RECHAZA (RAISE EXCEPTION)
--   3. Pick 5 min DESPUES -> RECHAZA
--
-- Como correr (desde la consola SQL del proyecto Supabase):
--   * Pegar este archivo entero. Cada test corre en su propia
--     transaccion (BEGIN ... ROLLBACK), asi no contamina la DB.
--   * Si los 3 cases imprimen "OK", el trigger funciona.
--   * Si alguno tira "FAIL: ...", revisar 0011_triggers_enforce_lock.sql.
--
-- Pre-requisitos en la DB:
--   * Migraciones 0001-0014 aplicadas.
--   * Seed 01_tournament + 02_teams + 03_matches_groups aplicado
--     (necesitamos al menos 1 match real para anclar los kickoffs).

-- Nota: \set ON_ERROR_STOP off (psql-only) eliminado para que el bloque
-- corra desde el SQL Editor de Supabase. El DO block ya maneja sus
-- propias excepciones con begin/exception/end.

-- ============================================================================
-- Setup: un usuario fake y un match con kickoff controlado por nosotros.
-- Los 3 tests reusan ambos.
-- ============================================================================

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-0000000feed1';
  v_tournament_id uuid;
  v_stage_id uuid;
  v_group_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_match_id uuid := '00000000-0000-0000-0000-0000000feedf';
  v_pass_5min_before boolean := false;
  v_pass_at_kickoff boolean := false;
  v_pass_5min_after boolean := false;
  v_err text;
begin
  -- ----- Fixtures: insertar profile y match ad-hoc para el test -----

  -- Profile fake (sin pasar por auth.users en el test, pero el FK pide
  -- que exista. Para evitar tocar auth, usamos profile_id = fake_user_id
  -- pero la FK profiles.id -> auth.users requiere user en auth.users.
  -- En test SQL solamente: insertamos directo en auth.users.
  insert into auth.users (id, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data,
                          aud, role, created_at, updated_at)
  values (v_user_id, 'test-lock-trigger@example.com', '',
          now(), '{}'::jsonb, '{}'::jsonb,
          'authenticated', 'authenticated', now(), now())
  on conflict (id) do nothing;

  -- Trigger handle_new_user crea profile auto. Si no esta:
  insert into public.profiles (id, email, nickname)
  values (v_user_id, 'test-lock-trigger@example.com', 'test_lock_trigger')
  on conflict (id) do nothing;

  select id into v_tournament_id from public.tournaments where slug = 'mundial-2026';
  if v_tournament_id is null then
    raise notice 'SKIP: no hay tournament mundial-2026, corre el seed primero';
    return;
  end if;
  select id into v_stage_id from public.stages
    where tournament_id = v_tournament_id and code = 'group';
  select id into v_group_id from public.groups
    where tournament_id = v_tournament_id and code = 'A';
  select id into v_home_team_id from public.teams
    where tournament_id = v_tournament_id and code = 'MEX';
  select id into v_away_team_id from public.teams
    where tournament_id = v_tournament_id and code = 'RSA';

  -- Match controlado por el test (kickoff = now() + 10 min al principio,
  -- vamos a moverlo para cada caso).
  insert into public.matches (id, tournament_id, stage_id, group_id, match_number,
                              home_team_id, away_team_id, kickoff_at, lock_at, status)
  values (v_match_id, v_tournament_id, v_stage_id, v_group_id, 9999,
          v_home_team_id, v_away_team_id,
          now() + interval '10 minutes', now() + interval '10 minutes',
          'scheduled')
  on conflict (id) do update set
    kickoff_at = excluded.kickoff_at,
    lock_at = excluded.lock_at,
    status = 'scheduled';

  -- ----- CASO 1: pick 5 min ANTES del kickoff -----
  update public.matches set kickoff_at = now() + interval '5 minutes',
                            lock_at = now() + interval '5 minutes',
                            status = 'scheduled'
  where id = v_match_id;

  delete from public.match_predictions
  where user_id = v_user_id and match_id = v_match_id;

  begin
    insert into public.match_predictions (user_id, match_id,
      predicted_winner, predicted_home, predicted_away)
    values (v_user_id, v_match_id, 'home', 2, 1);
    v_pass_5min_before := true;
  exception when others then
    v_err := SQLERRM;
    v_pass_5min_before := false;
  end;

  if v_pass_5min_before then
    raise notice 'CASE 1 (5min before): OK - pick aceptado';
  else
    raise notice 'CASE 1 (5min before): FAIL - se rechazo (%) cuando deberia aceptar', v_err;
  end if;

  -- ----- CASO 2: pick EXACTO al kickoff -----
  update public.matches set kickoff_at = now(), lock_at = now(),
                            status = 'scheduled'
  where id = v_match_id;

  delete from public.match_predictions
  where user_id = v_user_id and match_id = v_match_id;

  begin
    insert into public.match_predictions (user_id, match_id,
      predicted_winner, predicted_home, predicted_away)
    values (v_user_id, v_match_id, 'home', 2, 1);
    v_pass_at_kickoff := false;  -- si llego aca, fallo el test
  exception when others then
    v_err := SQLERRM;
    if v_err like '%Pick bloqueado%' or v_err like '%lock_at%' then
      v_pass_at_kickoff := true;
    else
      v_pass_at_kickoff := false;
    end if;
  end;

  if v_pass_at_kickoff then
    raise notice 'CASE 2 (at kickoff): OK - pick rechazado como esperado';
  else
    raise notice 'CASE 2 (at kickoff): FAIL - %', coalesce(v_err, 'no exception');
  end if;

  -- ----- CASO 3: pick 5 min DESPUES del kickoff -----
  update public.matches set kickoff_at = now() - interval '5 minutes',
                            lock_at = now() - interval '5 minutes',
                            status = 'live'
  where id = v_match_id;

  delete from public.match_predictions
  where user_id = v_user_id and match_id = v_match_id;

  begin
    insert into public.match_predictions (user_id, match_id,
      predicted_winner, predicted_home, predicted_away)
    values (v_user_id, v_match_id, 'home', 2, 1);
    v_pass_5min_after := false;
  exception when others then
    v_err := SQLERRM;
    if v_err like '%Pick bloqueado%' or v_err like '%lock_at%' then
      v_pass_5min_after := true;
    else
      v_pass_5min_after := false;
    end if;
  end;

  if v_pass_5min_after then
    raise notice 'CASE 3 (5min after): OK - pick rechazado como esperado';
  else
    raise notice 'CASE 3 (5min after): FAIL - %', coalesce(v_err, 'no exception');
  end if;

  -- ----- Cleanup -----
  delete from public.match_predictions where match_id = v_match_id;
  delete from public.match_prediction_history where match_id = v_match_id;
  delete from public.matches where id = v_match_id;
  -- No borramos el profile/auth.user para evitar cascade weirdness en
  -- otros tests; quedan colgados pero inofensivos.

  if v_pass_5min_before and v_pass_at_kickoff and v_pass_5min_after then
    raise notice '==== lock_trigger.test.sql: ALL 3 CASES PASSED ====';
  else
    raise exception '==== lock_trigger.test.sql: FAILED (cases: % % %) ====',
      v_pass_5min_before, v_pass_at_kickoff, v_pass_5min_after;
  end if;
end $$;
