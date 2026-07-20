-- One-off: cierre de las predicciones globales al terminar el Mundial 2026.
-- Resultados reales: campeón España, subcampeón Argentina,
-- Bota de Oro Mbappé (Francia), Balón de Oro Rodri (España).
-- Revelación NO puntúa por decisión del grupo: se marca scored sin puntos.
begin;

select set_config(
  'request.jwt.claims',
  '{"sub":"9981d96d-8466-4f85-af7c-29b0f51d7bd0","role":"authenticated"}',
  true
);

-- Campeón: España
select public.resolve_global(
  (select id from tournaments order by starts_at limit 1),
  'champion',
  (select id from teams where name = 'España'),
  null,
  'Final: España 1-0 Argentina. España campeón del mundo.'
) as champion_aciertos;

-- Subcampeón: Argentina
select public.resolve_global(
  (select id from tournaments order by starts_at limit 1),
  'runner_up',
  (select id from teams where name = 'Argentina'),
  null,
  'Final: España 1-0 Argentina. Argentina subcampeón.'
) as runner_up_aciertos;

-- Goleador: Mbappé (Francia). El RPC matchea por nombre exacto normalizado,
-- así que se llama una vez por cada variante que cargaron los jugadores.
select public.resolve_global(
  (select id from tournaments order by starts_at limit 1),
  'top_scorer',
  (select id from teams where name = 'Francia'),
  'Mbappe',
  'Bota de Oro: Kylian Mbappé, 10 goles.'
) as top_scorer_mbappe;

select public.resolve_global(
  (select id from tournaments order by starts_at limit 1),
  'top_scorer',
  (select id from teams where name = 'Francia'),
  'Kylian Mbappe',
  'Bota de Oro: Kylian Mbappé, 10 goles (variante de nombre).'
) as top_scorer_kylian_mbappe;

select public.resolve_global(
  (select id from tournaments order by starts_at limit 1),
  'top_scorer',
  (select id from teams where name = 'Francia'),
  'El dictador Mbappe',
  'Bota de Oro: Kylian Mbappé, 10 goles (variante joda, es Mbappé igual).'
) as top_scorer_dictador;

-- MVP: Rodri (España). Nadie lo tenía, se espera 0 aciertos.
select public.resolve_global(
  (select id from tournaments order by starts_at limit 1),
  'mvp',
  (select id from teams where name = 'España'),
  'Rodri',
  'Balón de Oro: Rodri (España).'
) as mvp_aciertos;

-- Revelación: se cierra sin puntuar (decisión del grupo).
update global_predictions
set state = 'scored', scored_at = now()
where category = 'revelation' and state <> 'scored';

insert into audit_log (actor_id, action, target_table, target_id, reason, after_state)
values (
  '9981d96d-8466-4f85-af7c-29b0f51d7bd0',
  'resolve_global',
  'global_predictions',
  null,
  'Revelación cerrada sin puntuar por decisión del grupo.',
  jsonb_build_object('category', 'revelation', 'awarded', 0)
);

commit;

-- Verificación
select category, state, count(*) from global_predictions group by 1, 2 order by 1, 2;
select p.nickname, pl.rule_key, pl.points
from points_log pl join profiles p on p.id = pl.user_id
where pl.source_kind = 'global'
order by pl.rule_key, p.nickname;
