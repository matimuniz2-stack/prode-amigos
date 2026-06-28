-- 20260628120000_open_r32_defined.sql
-- Carga los 16avos (Round of 32) del Mundial 2026 con los equipos YA definidos
-- y los abre para pickear. Hardcodeado por código de equipo (no depende de la
-- RPC resolve_brackets ni de que los resultados de grupos estén cargados).
-- Idempotente: se puede correr varias veces.
--
-- Fuente de los cruces: bracket oficial FIFA / Wikipedia "2026 FIFA World Cup
-- knockout stage" (verificado contra el bracket del seed, migración 0018).
--
-- Mapa partido -> (local, visitante) con su posición de grupo:
--   73  RSA(2A) - CAN(2B)        81  USA(1D) - BIH(3B)
--   74  GER(1E) - PAR(3D)        82  BEL(1G) - SEN(3I)
--   75  NED(1F) - MAR(2C)        83  POR(2K) - CRO(2L)
--   76  BRA(1C) - JPN(2F)        84  ESP(1H) - AUT(2J)
--   77  FRA(1I) - SWE(3F)        85  SUI(1B) - ALG(3J)
--   78  CIV(2E) - NOR(2I)        86  ARG(1J) - CPV(2H)
--   79  MEX(1A) - ECU(3E)        87  COL(1K) - GHA(3L)
--   80  ENG(1L) - COD(3K)        88  AUS(2D) - EGY(2G)
--
-- Correr como admin/owner en el SQL Editor del dashboard.

do $$
declare
  v_tournament uuid := '00000000-0000-0000-0000-00000000a001';
  v_row        record;
  v_home       uuid;
  v_away       uuid;
  v_opened     int := 0;
begin
  for v_row in
    select * from (values
      (73, 'RSA', 'CAN'),
      (74, 'GER', 'PAR'),
      (75, 'NED', 'MAR'),
      (76, 'BRA', 'JPN'),
      (77, 'FRA', 'SWE'),
      (78, 'CIV', 'NOR'),
      (79, 'MEX', 'ECU'),
      (80, 'ENG', 'COD'),
      (81, 'USA', 'BIH'),
      (82, 'BEL', 'SEN'),
      (83, 'POR', 'CRO'),
      (84, 'ESP', 'AUT'),
      (85, 'SUI', 'ALG'),
      (86, 'ARG', 'CPV'),
      (87, 'COL', 'GHA'),
      (88, 'AUS', 'EGY')
    ) as t(num, home, away)
  loop
    select id into v_home from public.teams
      where tournament_id = v_tournament and code = v_row.home;
    select id into v_away from public.teams
      where tournament_id = v_tournament and code = v_row.away;

    if v_home is null or v_away is null then
      raise exception 'No encontré equipo % o % en el torneo', v_row.home, v_row.away;
    end if;

    -- No pisar un cruce que ya empezó o terminó: solo los que siguen pendientes/programados.
    update public.matches
    set home_team_id = v_home,
        away_team_id = v_away,
        status = 'scheduled'
    where tournament_id = v_tournament
      and match_number = v_row.num
      and status in ('pending_bracket', 'scheduled');

    v_opened := v_opened + (case when found then 1 else 0 end);
  end loop;

  insert into public.audit_log (actor_id, action, target_table, reason, after_state)
  values (auth.uid(), 'open_r32_defined', 'matches',
          'Carga de los 16avos definidos (Round of 32, partidos 73-88)',
          jsonb_build_object('matches_updated', v_opened));

  raise notice '16avos cargados/abiertos: %', v_opened;
end $$;
