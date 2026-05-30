-- 0022_fix_visibility.sql
-- BUG (auditoría): is_match_visible solo miraba lock_at. Un partido en
-- 'pending_bracket' (cruce KO sin definir) o 'void' con lock_at pasado podría
-- exponer picks ajenos. La privacidad de picks es la regla #1 del prode.
-- Fix: exigir además que el partido esté realmente en juego o jugado
-- (excluir pending_bracket / cancelled / void / postponed). Los 'scheduled'
-- con lock pasado (ventana previa al kickoff) siguen revelándose, que es lo
-- esperado ("si ya no podés editar, todos pueden ver").

create or replace function public.is_match_visible(p_match_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.lock_at <= now()
      and m.status not in ('pending_bracket', 'cancelled', 'void', 'postponed')
  );
$$;
