-- 0010_rls_policies.sql
-- Row Level Security en todas las tablas. La policy clave es la de
-- match_predictions: read propio + de ajenos solo despues del lock,
-- insert/update solo propios y solo si lock_at > now(), DELETE bloqueado
-- (no hay policy de delete => imposible).

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.stages enable row level security;
alter table public.groups enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_predictions enable row level security;
alter table public.match_prediction_history enable row level security;
alter table public.global_predictions enable row level security;
alter table public.match_events enable row level security;
alter table public.pools enable row level security;
alter table public.prize_rules enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.points_log enable row level security;
alter table public.audit_log enable row level security;

-- ============================================================================
-- profiles
-- ============================================================================
create policy profiles_read_all on public.profiles
  for select using (true);

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Dimensiones publicas: tournaments / stages / groups / teams / matches
-- ============================================================================
create policy tournaments_read on public.tournaments for select using (true);
create policy tournaments_admin on public.tournaments for all
  using (public.is_admin()) with check (public.is_admin());

create policy stages_read on public.stages for select using (true);
create policy stages_admin on public.stages for all
  using (public.is_admin()) with check (public.is_admin());

create policy groups_read on public.groups for select using (true);
create policy groups_admin on public.groups for all
  using (public.is_admin()) with check (public.is_admin());

create policy teams_read on public.teams for select using (true);
create policy teams_admin on public.teams for all
  using (public.is_admin()) with check (public.is_admin());

create policy matches_read on public.matches for select using (true);
create policy matches_admin on public.matches for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- match_predictions (la parte caliente)
-- ============================================================================
create policy mp_read on public.match_predictions
  for select using (
    user_id = auth.uid()
    or public.is_match_visible(match_id)
    or public.is_admin()
  );

create policy mp_insert on public.match_predictions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lock_at > now()
    )
  );

create policy mp_update on public.match_predictions
  for update using (
    user_id = auth.uid()
    and state = 'open'
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lock_at > now()
    )
  ) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lock_at > now()
    )
  );

-- Sin policy de DELETE => imposible borrar picks (chau bypass del audit).

-- ============================================================================
-- match_prediction_history (read propio y admin; insert via trigger)
-- ============================================================================
create policy mph_read on public.match_prediction_history
  for select using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- global_predictions
-- ============================================================================
create policy gp_read on public.global_predictions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.globals_lock_at <= now()
    )
    or public.is_admin()
  );

create policy gp_insert on public.global_predictions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.globals_lock_at > now()
    )
  );

create policy gp_update on public.global_predictions
  for update using (
    user_id = auth.uid()
    and state = 'open'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.globals_lock_at > now()
    )
  ) with check (user_id = auth.uid());

-- ============================================================================
-- match_events (read all, admin para todo lo demas)
-- ============================================================================
create policy match_events_read on public.match_events for select using (true);
create policy match_events_admin on public.match_events for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- pools / prize_rules (read all para mostrar el ranking proyectado)
-- ============================================================================
create policy pools_read on public.pools for select using (true);
create policy pools_admin on public.pools for all
  using (public.is_admin()) with check (public.is_admin());

create policy prize_rules_read on public.prize_rules for select using (true);
create policy prize_rules_admin on public.prize_rules for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- scoring_rules / points_log (read all; admin escribe via RPC)
-- ============================================================================
create policy scoring_rules_read on public.scoring_rules for select using (true);
create policy scoring_rules_admin on public.scoring_rules for all
  using (public.is_admin()) with check (public.is_admin());

create policy points_log_read on public.points_log for select using (true);
create policy points_log_admin on public.points_log for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- audit_log (read solo admin; insert solo via RPC con SECURITY DEFINER)
-- ============================================================================
create policy audit_log_read on public.audit_log
  for select using (public.is_admin());
