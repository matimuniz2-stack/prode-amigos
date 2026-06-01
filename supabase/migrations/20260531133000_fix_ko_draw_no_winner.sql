-- 0029_fix_ko_draw_no_winner.sql
-- Auditoría 2026-05-31 (hallazgo #4): en un KO el fallback usaba el 1X2 de los
-- 90' cuando no había ko_winner_team_id cargado. Si el partido terminó empatado
-- a los 90' (siempre se define por penales/alargue), eso le daba puntos de
-- "ganador" a quien predijo EMPATE, cuando en realidad alguien pasó. Fix: en KO
-- empatado a los 90' sin ko_winner cargado, NADIE acierta "quién pasa" (queda en
-- 0 winner) hasta que el admin cargue el ganador y recalcule. El marcador exacto
-- de los 90' se sigue otorgando. Mantiene el coalesce defensivo de 0026.

create or replace function public.calculate_match(p_match_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_stage public.stages%rowtype;
  v_pred record;
  v_winner text;
  v_is_ko boolean;
  v_got_winner boolean;
  v_points int;
  v_total int := 0;
  v_breakdown jsonb;
  v_winner_pts int;
  v_exact_pts int;
  v_diff_pts int;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found or v_match.status <> 'finished' then
    return 0;
  end if;
  if v_match.score_home is null or v_match.score_away is null then
    return 0;
  end if;

  select * into v_stage from public.stages where id = v_match.stage_id;
  v_is_ko := v_stage.code <> 'group';

  if v_match.score_home > v_match.score_away then
    v_winner := 'home';
  elsif v_match.score_home < v_match.score_away then
    v_winner := 'away';
  else
    v_winner := 'draw';
  end if;

  for v_pred in
    select * from public.match_predictions
    where match_id = p_match_id
      and state in ('open', 'locked', 'scored')
  loop
    v_points := 0;
    v_breakdown := jsonb_build_object();

    select coalesce(sr.points, 0) into v_winner_pts
    from public.scoring_rules sr
    where sr.tournament_id = v_match.tournament_id
      and sr.rule_key = 'winner_correct'
      and (sr.scope_stage = v_stage.code or sr.scope_stage = '*')
      and sr.active_to is null
    order by case when sr.scope_stage = v_stage.code then 0 else 1 end,
             sr.version desc
    limit 1;

    select coalesce(sr.points, 0) into v_exact_pts
    from public.scoring_rules sr
    where sr.tournament_id = v_match.tournament_id
      and sr.rule_key = 'exact_score'
      and (sr.scope_stage = v_stage.code or sr.scope_stage = '*')
      and sr.active_to is null
    order by case when sr.scope_stage = v_stage.code then 0 else 1 end,
             sr.version desc
    limit 1;

    select coalesce(sr.points, 0) into v_diff_pts
    from public.scoring_rules sr
    where sr.tournament_id = v_match.tournament_id
      and sr.rule_key = 'goal_diff_correct'
      and sr.active_to is null
    order by sr.version desc
    limit 1;

    v_winner_pts := coalesce(v_winner_pts, 0);
    v_exact_pts := coalesce(v_exact_pts, 0);
    v_diff_pts := coalesce(v_diff_pts, 0);

    -- ¿Acertó "el ganador"?
    if v_is_ko then
      if v_match.ko_winner_team_id is not null then
        -- KO con ganador cargado: acertar quién pasa.
        v_got_winner := (v_pred.predicted_ko_winner_team_id = v_match.ko_winner_team_id);
      elsif v_winner <> 'draw' then
        -- KO definido en los 90' (sin penales): el ganador del marcador avanza.
        v_got_winner := (v_pred.predicted_winner = v_winner);
      else
        -- KO empatado a los 90' sin ganador cargado: indefinido, nadie acierta
        -- "quién pasa" hasta que el admin cargue ko_winner_team_id y recalcule.
        v_got_winner := false;
      end if;
    else
      -- Grupos: 1X2 de los 90'.
      v_got_winner := (v_pred.predicted_winner = v_winner);
    end if;

    if v_got_winner then
      v_points := v_points + v_winner_pts;
      v_breakdown := v_breakdown || jsonb_build_object('winner_correct', v_winner_pts);
    end if;

    -- Marcador exacto de los 90' (independiente de quién pasa en KO).
    if v_pred.predicted_home = v_match.score_home
      and v_pred.predicted_away = v_match.score_away then
      v_points := v_points + v_exact_pts;
      v_breakdown := v_breakdown || jsonb_build_object('exact_score', v_exact_pts);
    elsif v_got_winner
      and (v_pred.predicted_home - v_pred.predicted_away)
          = (v_match.score_home - v_match.score_away) then
      v_points := v_points + v_diff_pts;
      v_breakdown := v_breakdown || jsonb_build_object('goal_diff_correct', v_diff_pts);
    end if;

    insert into public.points_log (
      user_id, tournament_id, source_kind, source_id,
      rule_key, scope_stage, points, breakdown
    ) values (
      v_pred.user_id, v_match.tournament_id, 'match', p_match_id,
      'aggregate', v_stage.code, v_points, v_breakdown
    )
    on conflict (user_id, source_kind, source_id, rule_key)
    do update set points = excluded.points,
                  breakdown = excluded.breakdown,
                  awarded_at = now();

    update public.match_predictions
    set state = 'scored', scored_at = now()
    where id = v_pred.id;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;
