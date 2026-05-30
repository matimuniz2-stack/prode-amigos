-- 0025_resolve_thirds_rpc.sql
-- BUG (auditoría): assignThirds escribía away_team_id directo (RLS) sin validar
-- el grupo permitido del slot ni auditar, y con N updates no atómicos → se podía
-- abrir un cruce con el equipo equivocado, sin rastro. Lo pasamos a una RPC
-- SECURITY DEFINER que valida + audita + abre los cruces, todo en una transacción.

create or replace function public.resolve_thirds(
  p_assignments jsonb,   -- [{"match": 74, "team": "<uuid>"}, ...]
  p_reason text
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_match int;
  v_team uuid;
  v_group text;
  v_allowed text[];
  v_count int := 0;
  v_tournament uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason requerido' using errcode = 'P0001';
  end if;

  select id into v_tournament
  from public.tournaments order by starts_at asc limit 1;

  for v_item in select * from jsonb_array_elements(p_assignments)
  loop
    v_match := (v_item->>'match')::int;
    v_team := nullif(v_item->>'team', '')::uuid;
    if v_team is null then
      continue;
    end if;

    -- Grupos permitidos por slot de tercero (bracket oficial 2026)
    v_allowed := case v_match
      when 74 then array['A','B','C','D','F']
      when 77 then array['C','D','F','G','H']
      when 79 then array['C','E','F','H','I']
      when 80 then array['E','H','I','J','K']
      when 81 then array['B','E','F','I','J']
      when 82 then array['A','E','H','I','J']
      when 85 then array['E','F','G','I','J']
      when 87 then array['D','E','I','J','L']
      else null
    end;
    if v_allowed is null then
      raise exception 'El partido % no es un cruce de tercero', v_match
        using errcode = 'P0001';
    end if;

    select g.code into v_group
    from public.teams t
    join public.groups g on g.id = t.group_id
    where t.id = v_team and t.tournament_id = v_tournament;
    if v_group is null then
      raise exception 'No encontré el equipo % en el torneo', v_team
        using errcode = 'P0002';
    end if;
    if not (v_group = any(v_allowed)) then
      raise exception 'El tercero del grupo % no puede ir al partido % (permitidos: %)',
        v_group, v_match, array_to_string(v_allowed, '/')
        using errcode = 'P0001';
    end if;

    -- No puede estar ya en otra llave (1ro/2do/otro tercero)
    if exists (
      select 1 from public.matches m
      where m.tournament_id = v_tournament
        and m.match_number <> v_match
        and (m.home_team_id = v_team or m.away_team_id = v_team)
    ) then
      raise exception 'Ese equipo (%) ya está en otra llave', v_team
        using errcode = 'P0001';
    end if;

    update public.matches
    set away_team_id = v_team
    where tournament_id = v_tournament and match_number = v_match;
    v_count := v_count + 1;
  end loop;

  insert into public.audit_log (actor_id, action, target_table, reason, after_state)
  values (auth.uid(), 'resolve_thirds', 'matches', p_reason, p_assignments);

  -- Abre (scheduled) los cruces que ya quedaron completos.
  perform public.resolve_brackets(v_tournament, 'Asignación de terceros');

  return v_count;
end;
$$;

grant execute on function public.resolve_thirds(jsonb, text) to authenticated;
