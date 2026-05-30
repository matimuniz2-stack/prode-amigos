-- 0024_lock_5min_antes.sql
-- Decisión de Mati (cambia la del PLAN original de lock = kickoff): los picks
-- cierran 5 minutos ANTES del kickoff, para que nadie pueda editar con info de
-- último momento (alineaciones, etc.). Anti-trampa con plata de por medio.
-- Idempotente: solo toca los que todavía tienen lock_at = kickoff_at.
-- Aplica a grupos y a KO (cuando un cruce se resuelve a 'scheduled', su lock
-- ya queda 5 min antes). NO toca globals_lock_at (es un deadline aparte).

update public.matches
set lock_at = kickoff_at - interval '5 minutes'
where lock_at = kickoff_at;
