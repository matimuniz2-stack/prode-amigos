# Plan — Prode entre amigos · Mundial 2026

## DECISIONES PASO 0 CONFIRMADAS (prioridad absoluta — sobreescriben todo lo demás)

### Pozo
- Pagos gestionados **por afuera** (no en la app).
- En la app sólo se muestra como **meta visual al costado del ranking**: `pools.total_amount` editable por admin, `projected_prize` por user.
- **`pool_contributions` SE ELIMINA del MVP**. Tabla `pools` queda con solo `id, tournament_id, total_amount, currency, status`.
- Monto + moneda: a definir más adelante por el usuario; default placeholder `0 ARS` hasta que lo cargue.

### Admins
- **Único admin/owner: matimuniz2@gmail.com, nickname "Mati Muñiz", role='owner'**.
- Seed crea exactamente 1 row de profile con role='owner'.
- Si después se necesita segundo admin: 1 UPDATE manual en Supabase. Sin UI de gestión de roles en MVP.

### Globales — categorías y formato
- **5 categorías**: `champion`, `runner_up`, `top_scorer`, `mvp`, `revelation`. (Sin tercer puesto.)
- `champion`, `runner_up`: dropdown de 48 equipos (`team_id`).
- `top_scorer`, `mvp`, `revelation`: **híbrido**: dropdown equipo (`player_team_id NOT NULL`) + input texto libre del nombre (`player_name`).
- Constraint: `(category IN ('top_scorer','mvp','revelation')) → player_team_id IS NOT NULL AND player_name IS NOT NULL`.
- Normalización de nombres (Messi/Mbappé/etc.) la hace el admin al final del torneo via RPC `resolve_global(category, team_id, player_name)`.

### Penalización por no cargar pick = pick random
- Cron de lock, al pasar `lock_at`, **crea predicción placeholder** para users que no cargaron:
  - `predicted_home = random(0..3)`, `predicted_away = random(0..3)` uniforme.
  - `predicted_winner` derivado del score (consistente por construcción).
  - Flag nuevo en `match_predictions`: `is_auto_random boolean DEFAULT false` → `true` para autogenerados.
- En leaderboard / historial, los picks auto se renderizan con un icono "🎲 auto" para que se note.
- KO: si requiere `predicted_ko_winner_team_id` y es random, se elige uniforme entre los 2 equipos.

### Flujo de picks de KO
- **Picks de KO se abren cuando se resuelve cada cruce**, no antes.
- Modelo: `matches` KO se crean en seed con `home_team_id=NULL`, `away_team_id=NULL`, `home_placeholder='W-A'`, `away_placeholder='2nd-D'`, `status='pending_bracket'`.
- Cuando termina la fase de grupos / KO previo: admin corre **RPC `resolve_ko_round(stage_code)`** que:
  - Lee resultados de la ronda anterior (matches finished).
  - Calcula clasificados (1ro/2do de cada grupo en fase grupos, ganadores en KO).
  - Popula `home_team_id`/`away_team_id` en los partidos del cruce siguiente.
  - Cambia `status='pending_bracket' → 'scheduled'`.
  - A partir de ahí los amigos pueden cargar pick (el RLS de insert ya valida `lock_at > now()` y la UI muestra el partido como "abierto").
- Audit_log registra cada resolución de cruce con quién la corrió.
- Si el admin se equivoca: hay RPC `revert_ko_round(stage_code)` que vuelve los matches a `pending_bracket` (solo si nadie cargó pick aún — si ya cargaron, requiere reason y va a audit).

### Live durante el partido
- **Sí en MVP**: score live minuto a minuto + **timeline de eventos** (goles, tarjetas).
- **NO en MVP**: push notifications, service worker, iOS PWA hassle.
- **Tabla nueva `match_events`**:
  ```sql
  CREATE TABLE match_events (
    id uuid PK, match_id uuid FK,
    kind text CHECK (kind IN ('goal','yellow_card','red_card','substitution','penalty','own_goal','var')),
    minute int,
    team_id uuid FK NULL,
    player_name text,
    detail jsonb,
    external_event_id text,           -- idempotencia con API
    occurred_at timestamptz DEFAULT now(),
    UNIQUE (match_id, external_event_id)
  );
  ```
- **Cron Vercel** `/api/cron/poll-results`:
  - Schedule: cada 1 min durante ventanas de partidos live (admin define window o se calcula de `matches`), cada 1 hora fuera de ventanas.
  - Por cada match con `status IN ('scheduled' AND kickoff_at <= now()) OR 'live'`:
    - Llama ESPN no oficial (primaria) via `espn_event_id`.
    - Upsert `score_home`, `score_away`, `status`.
    - Upsert `match_events` (idempotente por `external_event_id`).
    - Si `status` transiciona a `finished`: setea `finalized_at = now()`, `result_source='api'`, dispara `calculate_match(id)`.
- **UI**: página del partido auto-refresca cada 30s vía `setInterval` + `router.refresh()`. Componente client-only chico, el resto sigue Server Components. Timeline visible con minuto, ícono por tipo, jugador y equipo.
- Admin override: panel `/admin/results` permite forzar `score_home/score_away/status` y crear/borrar eventos manualmente. Pasa por RPC + audit.

### Resumen de impacto en migraciones
- `0004_matches.sql`: agregar `status='pending_bracket'`.
- `0005_predictions.sql`: agregar `is_auto_random boolean DEFAULT false`. Eliminar `pool_contributions`. Agregar `player_team_id` en `global_predictions` con check.
- `0006_match_events.sql`: NUEVA migración para timeline.
- `0007_pools.sql`: simplificar (solo `pools`, sin `contributions`).
- `0012_rpcs.sql`: agregar `resolve_ko_round`, `revert_ko_round`, `resolve_global`.
- `0013_cron.sql`: incluir poll-results cada 1 min en ventana de live.

---

## AJUSTES POST-REVISIÓN DEL USUARIO (prioridad sobre el resto del plan)

Estos puntos sobrescriben lo que esté más abajo:

1. **Realtime fuera del MVP.** No configurar Supabase Realtime. Leaderboard se actualiza con `revalidatePath` o polling cada ~30s. Realtime → Fase 2. La sección §3 ("Realtime / cierre de deadlines") sigue válida solo para el cron de lock + integración API; el suscripcionismo de canales NO va en MVP.
2. **Sin materialized views en MVP.** La view `leaderboard_projection` es una view normal (`CREATE VIEW`), no `MATERIALIZED`. Refresh automático no aplica.
3. **Reglas de scoring congeladas pre-torneo.** No implementar versionado mid-torneo en MVP. El admin edita `scoring_rules` solo mientras `tournaments.status != 'live'`. RPC de update bloquea si live. Versionado completo (`active_from`/`active_to`/`version`) queda como columnas en la tabla pero **no se usa lógicamente** en MVP — siempre se lee la fila vigente. Versionado real → Fase 3.
4. **Tests SQL del trigger de lock = OBLIGATORIOS** como parte del "done" de la Fase 1, antes de cualquier UI. Los 3 casos: 5 min antes del kickoff (debe aceptar) / justo al kickoff (debe rechazar) / 5 min después (debe rechazar).
5. **Segundo admin desde el seed.** El seed crea `profiles` con `role='admin'` para una segunda cuenta de confianza (definida en PASO 0). No es opcional.
6. **Plan vive como `PLAN.md` en la raíz del repo nuevo.** Antes de arrancar Fase 0 hay que copiar este archivo a `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode-amigos\PLAN.md`.
7. **Proceso de trabajo:** implementación fase por fase, parando al final de cada una mostrando qué se hizo + criterio de done + cómo verificar, esperando "OK, seguí" antes de la siguiente. Commits atómicos por hito con mensajes claros (ej. `feat(schema): migraciones 0001-0004 + RLS predictions`). Trabajo en `main` con commits incrementales. Si algo del plan choca con la realidad al implementarlo: parar y avisar.
8. **Estándar de scaffolding:** partir del template oficial `with-supabase` de Vercel y adaptarlo (mitigación de curva React).
9. **Antes de escribir las 13 migraciones:** mostrar primero al usuario el orden + propósito + esquema de las tablas clave para que apruebe el modelo. No generar todas de una sin visto bueno.

## Context

Vamos a construir una **web app de prode multi-usuario** para jugar con 10-25 amigos durante el Mundial 2026 (11-jun → 19-jul 2026). Hay **pozo de plata** de por medio, así que la auditoría tiene que ser sólida — nada de "che, yo había cambiado mi pick antes del kickoff". El primer partido es el **11-jun-2026** y hoy es **28-may-2026**: tenemos **~2 semanas** para tener el MVP en producción con la inscripción abierta.

**Qué no es este proyecto**: no es el prode personal Cocos (ese ya vive en este repo, es 100% análisis Python + SPA estática para una sola persona). Este es una app social distinta, full-stack, con auth y DB. **Por eso va en un repo separado nuevo en `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode-amigos\`**, sin tocar el repo actual de prode.

**Lo único que reusamos del repo viejo**: data semilla (los 48 equipos, fixture base, sedes/fechas oficiales). Se copia/exporta una sola vez al arrancar — no hay link vivo entre repos.

---

## 1. Resumen del proyecto

App web mobile-first donde 10-25 amigos cargan sus predicciones de cada partido del Mundial 2026 (ganador + resultado exacto) y de categorías globales (campeón, goleador, MVP, subcampeón, finalistas, revelación). Cada partido tiene deadline duro al kickoff. El admin (yo) carga resultados (con asistencia de una API de fútbol). Hay tabla de posiciones en tiempo real, historial de cada amigo, y un pozo de plata que se reparte al final.

La gracia: cargada entre amigos viendo los picks de cada uno apenas arranca cada partido. Lo que lo hace lindo de usar: cero fricción para cargar desde el celular (login con Google, formulario de 2 campos por partido), countdown visible al deadline, y ranking que cambia partido a partido.

---

## 2. Stack y arquitectura

### Recomendado: Next.js 15 + Supabase + Vercel

| Capa | Elección | Por qué |
|---|---|---|
| Frontend + Backend | **Next.js 15 App Router** (TS) | RSC + Server Actions = menos código que API routes. Vercel deploy 1-click. |
| UI | **Tailwind + shadcn/ui** | Mobile-first probado, componentes copy-paste, sin pelear theming en V1. |
| DB | **Supabase Postgres** | RLS hace cumplir reglas en la DB (clave con plata). Realtime gratis. JSONB para reglas de scoring. |
| Auth | **Supabase Auth → Google OAuth solo** | Todos tenés Gmail. Magic link agrega fricción (spam, links rotos en mobile). Setup: ~30 min. |
| Realtime | **Supabase Realtime channels** | Leaderboard live cuando se cargan resultados. |
| Hosting | **Vercel Hobby + Supabase Free** | $0/mes para 25 users. |
| API resultados | **ESPN no oficial (primaria) + API-Football free (cross-check) + manual override** | ESPN gratis sin auth, ya tenemos `espn_event_id` en JSONs viejos. API-Football free = 100 req/día (cubre Mundial). Manual del admin = plan B siempre disponible. |

**Costo total estimado**: **$0/mes** durante el Mundial. Si API-Football free no alcanza por rate limits → upgrade a Pro ($19/mes) o seguir solo con ESPN + manual.

### Alternativa real (no de relleno): FastAPI + HTMX + Postgres en Fly.io

Stack 100% Python. Pros: usás lo que ya sabés (Python), HTMX cubre 95% de la interactividad necesaria, evitás curva React. Contras: realtime es polling (no streaming nativo), mobile UX la armás vos, Fly.io free se duerme (necesita ping cron o ~$3/mes para mantenerlo despierto), perdés el "polish" gratis de shadcn.

**Veredicto**: elegimos **Next.js + Supabase** sabiendo que perdés 2-3 días aprendiendo Server Actions y RLS. Razón decisiva: la plata de por medio empuja a **RLS server-side** (reglas en la DB, no en código de app) y **realtime nativo**. Si en el día 3 no te sentís cómodo, el pivot a FastAPI + HTMX es factible (mismo modelo de datos, distinta capa de presentación).

### Estructura de carpetas del nuevo repo (independiente)

```
C:\Users\matim\OneDrive\Escritorio\Proyectos\prode-amigos\
  package.json
  next.config.ts
  vercel.json                    # cron de poll de resultados
  .env.local.example
  README.md
  supabase/
    migrations/                  # SQL versionado (ver §3.6)
    seed/
      teams.sql                  # 48 selecciones
      matches_groups.sql         # 72 partidos fase de grupos
      matches_ko_placeholders.sql # 32 partidos KO con placeholders
      scoring_rules.sql
    config.toml
  src/
    app/
      layout.tsx
      page.tsx                   # landing
      login/page.tsx
      matches/
        page.tsx                 # fechas + lista
        [matchId]/page.tsx       # pick form (Server Action)
      globales/page.tsx
      leaderboard/page.tsx       # client, Realtime sub
      mi-prode/page.tsx          # historial del user
      admin/
        results/page.tsx
        rules/page.tsx
        pool/page.tsx
        audit/page.tsx
      api/cron/poll-results/route.ts
    components/{ui, MatchCard, PickForm, Countdown, Leaderboard}
    lib/
      supabase/{server, client, admin}.ts
      scoring.ts                 # mirror del SQL para tests
      espn.ts
      api-football.ts
    types/database.ts            # supabase gen types
  public/{icons, flags}
  scripts/
    seed_from_old_repo.py        # one-shot: lee JSONs del repo viejo y produce *.sql
```

---

## 3. Modelo de datos

### 3.1 Entidades clave (ver detalle SQL en §3.6)

| Tabla | Rol | Notas |
|---|---|---|
| `profiles` | extiende `auth.users` con nickname, avatar, role | role ∈ `player`/`admin`/`owner` |
| `tournaments` | Mundial 2026, su `status` (draft/registration/locked/live/finished) y `globals_lock_at` | un solo row por ahora |
| `stages` | group/r32/r16/qf/sf/tp/final con `scoring_profile` | 7 rows |
| `groups` | A–L | 12 rows |
| `teams` | 48 selecciones | seed desde JSON viejo |
| `matches` | 104 partidos | placeholders en KO hasta resolver |
| `match_predictions` | pick de cada user por partido (1X2 + exacto) | UNIQUE(user_id, match_id) |
| `match_prediction_history` | append-only de cada edit | auditoría |
| `global_predictions` | pick por categoría global (champion, top_scorer, mvp, runner_up, third_place, revelation) | UNIQUE(user_id, tournament_id, category) |
| `scoring_rules` | reglas configurables versionadas | ver §4 |
| `points_log` | puntos calculados — idempotente | UNIQUE(user_id, source_kind, source_id) |
| `pools`, `pool_contributions`, `prize_rules` | pozo + reglas de premios | ver §8 |
| `audit_log` | append-only de todo cambio de admin | reason obligatorio |

### 3.2 Estados críticos

- **`matches.status`**: `scheduled → live → finished` (más `postponed`/`cancelled`/`void` por las dudas).
- **`match_predictions.state`**: `open → locked → scored`. Transición `open→locked` la dispara cron al `lock_at` (= `kickoff_at`). `locked→scored` la dispara el calculador al `finalized_at` del match.
- **`tournaments.status`**: `draft → registration → locked → live → finished`. `registration` cierra cuando arranca el primer partido.

### 3.3 Soft delete

No existe DELETE en predicciones. Toda corrección queda en `*_history`. Una predicción "anulada" pasa a `state='void'` y deja de contar.

### 3.4 Visibilidad (decidida)

**Picks ajenos se revelan al `lock_at` de cada partido individual** (= kickoff). Función helper SQL `is_match_visible(match_id)` chequea `lock_at <= now()` y se usa en la RLS policy de SELECT.

### 3.5 Reusable del repo viejo

| Source | Uso |
|---|---|
| `research/simulacion/montecarlo.json` | 48 selecciones con nombres canónicos → seed `teams` |
| `research/reglas/formato_mundial_2026.md` | grupos A–L, fechas, sedes → seed `groups` + `matches` fase grupos |
| `research/reglas/cocos_reglamento.md` | puntajes por stage → defaults de `scoring_rules` |
| `output/data/*.json` | shape de referencia (`espn_event_id`, `kickoff_iso`) para el formato de seed |

Un script Python `scripts/seed_from_old_repo.py` lee esos archivos y produce los `.sql` de `supabase/seed/`. **Se corre una sola vez al inicio**, después el nuevo repo es autónomo.

### 3.6 Esquema SQL (sketch — detalle completo en migraciones)

```sql
-- 0003_matches.sql
CREATE TABLE matches (
  id uuid PK, tournament_id uuid FK, stage_id uuid FK, group_id uuid FK NULL,
  home_team_id uuid FK NULL, away_team_id uuid FK NULL,
  home_placeholder text, away_placeholder text,        -- 'W-A', '2nd-D' en KO
  kickoff_at timestamptz NOT NULL,
  lock_at timestamptz NOT NULL,                         -- = kickoff_at por simplicidad
  status text NOT NULL DEFAULT 'scheduled',
  score_home int, score_away int,
  ko_winner_team_id uuid FK,
  external_api_id text, result_source text,
  finalized_at timestamptz
);

-- 0005_predictions.sql
CREATE TABLE match_predictions (
  id uuid PK, user_id uuid FK, match_id uuid FK,
  predicted_winner text CHECK (predicted_winner IN ('home','draw','away')),
  predicted_home int CHECK (predicted_home BETWEEN 0 AND 20),
  predicted_away int CHECK (predicted_away BETWEEN 0 AND 20),
  predicted_ko_winner_team_id uuid FK NULL,
  state text DEFAULT 'open',
  created_at timestamptz, updated_at timestamptz,
  UNIQUE (user_id, match_id)
);
```

(El detalle completo de las ~13 migraciones está en el research del Plan agent y se escribe en `supabase/migrations/` durante la Fase 1 del roadmap.)

---

## 4. Motor de puntaje

Regla de oro: **todas las reglas viven en la tabla `scoring_rules`**, ninguna hardcoded en código.

```sql
CREATE TABLE scoring_rules (
  id uuid PK,
  tournament_id uuid FK,
  rule_key text NOT NULL,           -- 'winner_correct', 'exact_score', 'champion', ...
  scope_stage text,                 -- NULL = todas; 'group', 'r16', 'final', ...
  points int NOT NULL,
  params jsonb DEFAULT '{}',
  active_from timestamptz NOT NULL,
  active_to timestamptz NULL,
  version int DEFAULT 1,
  UNIQUE (tournament_id, rule_key, scope_stage, version)
);
```

### Catálogo MVP

| `rule_key` | `scope_stage` | Pts | Notas |
|---|---|---|---|
| `winner_correct` | group | 2 | Acertar 1/X/2 |
| `exact_score` | group | 3 | Adicional al `winner_correct` |
| `winner_correct` | r32 | 4 | KO escala |
| `exact_score` | r32 | 6 | |
| `winner_correct` | r16 | 5 | |
| `exact_score` | r16 | 8 | |
| ... escala hasta final | final | 15 / 22 | |
| `goal_diff_correct` | `*` | 1 | Solo si NO es exact (`only_if_not_exact`) |
| `champion` | — | 25 | global |
| `top_scorer` | — | 30 | global |
| `mvp` | — | 35 | global |
| `runner_up` | — | 10 | global (subcampeón) |
| `third_place` | — | 8 | global (tercer puesto opcional) |
| `revelation` | — | 8 | global |

Valores por defecto **se toman del reglamento Cocos** (`research/reglas/cocos_reglamento.md`) — el admin puede editarlos vía panel hasta que `tournaments.status` pase a `live`.

### Cómo evalúa

Edge function `calculate_match(match_id)` corre al setear `finalized_at`:
1. Lee `scoring_rules` filtradas por `scope_stage` y `active_from <= match.kickoff_at`.
2. Para cada `match_predictions` con `state='locked'`:
   - Calcula `breakdown` (qué reglas se cumplen).
   - `INSERT ... ON CONFLICT (user_id, source_kind, source_id) DO UPDATE` → **idempotente**.
   - Setea `state='scored'`.

### Versionado / cambios mid-tournament

- **Pre-torneo**: edits libres del admin.
- **Live**: cualquier edit crea **nueva fila** con `version+1` y `active_from=now()`; vieja queda `active_to=now()`. Partidos pasados conservan su scoring original. Edit pasa por `audit_log`.
- **MVP simplificado** (si aprieta el deadline): congelar reglas pre-torneo, no permitir edits live. Versionado completo en V2.

### Reglas opcionales para V2 (no MVP)

`streak_bonus` (3 aciertos seguidos +5), `perfect_group_bonus` (acertar todos los partidos de un grupo +10), `first_blood_bonus`.

---

## 5. Features — MVP vs después

### MVP (debe estar el 10-jun-2026)

- [ ] Login con Google
- [ ] Onboarding: elegir nickname (único), avatar opcional
- [ ] Vista "Próximos partidos" agrupados por fecha
- [ ] Form de pick por partido: 1X2 + resultado exacto, con countdown al kickoff
- [ ] Vista "Mis predicciones" (histórico)
- [ ] Vista "Globales": cargar campeón / goleador / MVP / subcampeón / revelación (deadline = 11-jun 18:00Z)
- [ ] Lock automático al kickoff (cron + trigger + RLS)
- [ ] Visibilidad: picks ajenos visibles solo después del lock de cada partido
- [ ] Panel admin: cargar resultados, recalcular puntos, ver audit
- [ ] Tabla de posiciones (realtime via Supabase Realtime)
- [ ] Vista "Pozo": total recaudado, premios proyectados según ranking actual
- [ ] PWA básica (manifest + icon) para "agregar a pantalla de inicio"

### Fase 2 (durante el Mundial si hay tiempo)

- Polling automático de resultados via ESPN/API-Football (reemplaza carga manual)
- Gráfico de evolución personal (puntos por fecha)
- Notificación push de "cierra la fecha en 2 horas" (Web Push)
- Chat / comentarios por partido
- Estadísticas: mejor fecha, mejor grupo, racha actual
- "Pronóstico apretado": resaltar partidos donde los amigos están más divididos

### Fase 3 (post-Mundial / próximos torneos)

- Multi-torneo (Libertadores, próxima Copa América, Liga argentina)
- Apodos y "metegoles" persistentes entre torneos (perfil global)
- Versionado completo de reglas mid-tournament
- Premios "menores" automáticos (mejor fecha, mejor grupo, perfect group)
- Markets extra (BTTS, Over/Under) — opcional, no es prioridad
- Export a Excel/PDF del torneo para guardar de souvenir

---

## 6. Reglas anti-trampa

Defensa en profundidad — **3 capas**:

### Capa 1 — RLS (Row Level Security en Postgres)

```sql
ALTER TABLE match_predictions ENABLE ROW LEVEL SECURITY;

-- Lectura: tus propios picks SIEMPRE; ajenos sólo si el match ya cerró
CREATE POLICY mp_read ON match_predictions
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_match_visible(match_id)
  );

-- Insert: solo de uno mismo y solo si el match aún no cerró
CREATE POLICY mp_insert ON match_predictions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id
                AND m.lock_at > now())
  );

-- Update: solo de uno mismo, solo si pick aún 'open', solo si match no cerró
CREATE POLICY mp_update ON match_predictions
  FOR UPDATE USING (
    user_id = auth.uid()
    AND state = 'open'
    AND EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.lock_at > now())
  );

-- DELETE: ninguna policy → físicamente imposible
```

### Capa 2 — Trigger Postgres (paranoia extra)

`BEFORE UPDATE ON match_predictions` que `RAISE EXCEPTION` si el match ya cerró. Además **escribe la versión vieja en `match_prediction_history`** en cada update — auditoría automática.

### Capa 3 — Cron de lock

Vercel Cron cada 60s corre función SQL que:
- Setea `state='locked'`, `locked_at=now()` para predicciones cuyo match cruzó `lock_at`.
- Crea predicciones placeholder vacías para users que no cargaron (opcional — define cómo se puntea: 0 pts vs penalización).
- Marca `matches.status='live'` post-kickoff.

### Visibilidad

Función `is_match_visible(match_id)` retorna `true` si `matches.lock_at <= now()`. Usada en `mp_read` policy. Simple, consistente: "si ya no podés editar, todos pueden ver".

### Edits del admin = audit forzado

Cualquier mutación que toque `matches.score_*`, `match_predictions.*` override, `scoring_rules.*`, `global_results.*` **solo se puede hacer vía RPC** (no UPDATE directo). El RPC exige `reason text NOT NULL` y escribe `audit_log` en la misma transacción. Players no pueden tocar estas tablas por RLS.

---

## 7. Panel de administración

| Pantalla | Acciones |
|---|---|
| `/admin` | Dashboard: status del torneo, próximos partidos, alertas (API caída, picks vacíos) |
| `/admin/results` | Cargar/corregir `score_home`/`score_away`/`ko_winner`. Botón "Finalizar partido" (setea `finalized_at` y dispara `calculate_match`). Mobile-friendly (vas a cargar desde el celu en un asado). |
| `/admin/rules` | CRUD de `scoring_rules` con preview "esto cambiaría N puntos en M usuarios". Bloqueado si `tournament.status='live'` (MVP) — Fase 2 abre versionado. |
| `/admin/pool` | Editar `pools.total_amount`, registrar `pool_contributions` (quién pagó), editar `prize_rules`, marcar `paid_out` al final. |
| `/admin/participants` | Lista de users registrados, role toggle, kick (soft) si alguien rompe algo. |
| `/admin/audit` | Tabla filtrable de `audit_log`. |
| `/admin/predictions/[userId]` | Ver picks de cualquier user **con doble confirmación + reason obligatorio** ("vas a violar privacidad — motivo:"). Queda en audit. |
| `/admin/recalc` | Botón "Recalcular todo" / "Recalcular partido X" / "Recalcular usuario X". |

Import de fixture: en MVP se hace una sola vez via `scripts/seed_from_old_repo.py`. Import CSV manual queda para Fase 2.

---

## 8. Premios

### Modelo

```sql
CREATE TABLE pools (
  id uuid PK, tournament_id uuid FK,
  total_amount numeric(12,2), currency text DEFAULT 'ARS',
  status text DEFAULT 'open'  -- open | closed | paid_out
);

CREATE TABLE pool_contributions (
  pool_id uuid FK, user_id uuid FK,
  amount numeric(12,2), paid_at timestamptz, paid_via text, receipt_ref text,
  UNIQUE (pool_id, user_id)
);

CREATE TABLE prize_rules (
  id uuid PK, pool_id uuid FK,
  rule_key text,            -- 'overall_1st', 'overall_2nd', 'overall_3rd', 'best_round', ...
  share_pct numeric(5,2),   -- 60.00 = 60%
  fixed_amount numeric(12,2),
  description text
);
```

### Reglas por defecto (configurables)

- 1º: 60% del pozo
- 2º: 25%
- 3º: 15%
- "Mejor fecha" (premio chico fijo): postergado a Fase 2

### Proyección "quién va ganando ahora"

Vista (materializada o no) `leaderboard_projection` que muestra: nickname, total_points, rank, `projected_prize` (calculado contra `prize_rules`). En la pantalla del leaderboard cada user ve "ahora mismo te tocarían $X".

### Tie-break

Empate en puntos → desempata `exact_score` correctos → si sigue empate → `winner_correct` en stages avanzadas → si sigue → reparten el premio entre ambos. Definido en `tournaments.config.tie_break`.

---

## 9. Roadmap por fases

**Restricción dura: deadline 11-jun-2026.** Hoy 28-may. 14 días de calendario, 10 hábiles. Plan ajustado a eso.

### Fase 0 — Setup (Día 1)
- `npx create-next-app@latest prode-amigos --typescript --tailwind --app`
- `npm i @supabase/ssr @supabase/supabase-js shadcn`
- Crear proyecto Supabase, copiar keys a `.env.local`
- Configurar Google OAuth en Supabase Dashboard (5 min)
- Deploy inicial a Vercel + dominio (subdominio `vercel.app` está bien para MVP)
- **Done cuando**: login con Google funciona en prod, redirige a `/dashboard` placeholder

### Fase 1 — Schema + RLS (Días 2-3)
- Escribir migraciones 0001-0013 (extensions, profiles, tournaments, matches, predictions, scoring, pools, audit, rls, triggers, views, rpcs, cron)
- 3 tests SQL del trigger de lock (5 min antes / exactly at / 5 min después)
- Script `scripts/seed_from_old_repo.py` que lee los JSONs del repo viejo y produce los SQL de seed
- Aplicar seed: 48 teams + 72 matches grupos + 32 matches KO con placeholders + scoring_rules default + pool vacío
- **Done cuando**: las 13 migraciones + seed aplicadas en Supabase, RLS bloquea cualquier intento de update post-lock, audit_log se escribe automáticamente

### Fase 2 — Pick form + lista de partidos (Días 4-5)
- `/matches` (RSC) — lista de fechas con partidos, status
- `/matches/[matchId]` (RSC + Server Action) — form de pick con countdown
- `/mi-prode` — historial de picks del user
- **Done cuando**: podés cargar pick desde mobile y se guarda; intento post-deadline falla con mensaje claro

### Fase 3 — Globales + leaderboard (Días 6-7)
- `/globales` — form de las 5 categorías (campeón, goleador, MVP, subcampeón, revelación)
- `/leaderboard` (Client Component) — tabla realtime suscrita a `points_log`
- Vista SQL `leaderboard_projection` con `projected_prize`
- **Done cuando**: el leaderboard se actualiza solo cuando admin finaliza un partido

### Fase 4 — Panel admin (Días 8-9)
- `/admin/results` mobile-friendly
- `/admin/rules` (CRUD bloqueado en live)
- `/admin/pool` (editar amount + contributions)
- `/admin/audit` (tabla simple)
- RPCs `match_set_result`, `recalc_match`, `recalc_all`
- **Done cuando**: podés cargar un resultado desde el celu, finalizar, y ver el leaderboard actualizarse

### Fase 5 — Polish + invitación (Días 10-11)
- PWA manifest + icon
- Mensaje de bienvenida con reglas
- Whitelist de emails de los amigos (RLS: `auth.users.email IN (allowlist)`)
- Mandar link con instrucciones por WhatsApp
- **Done cuando**: cada amigo logueado, con nickname elegido y al menos 1 pick de prueba cargado

### Fase 6 — Buffer / API integration (Días 12-13)
- Si todo OK: implementar `api/cron/poll-results` con ESPN + API-Football
- Si hay atraso: lo dejamos para post-MVP, admin carga manual durante el Mundial
- **Done cuando**: 11-jun arranca con los picks cerrados y el admin sabe cómo cargar resultados

### Fase 7 — Operación durante el Mundial (11-jun → 19-jul)
- Cargar resultados después de cada partido
- Atender reclamos via audit log
- (Opcional) ir implementando features de Fase 2 del producto entre fechas

---

## 10. Riesgos y decisiones abiertas

### Riesgos técnicos

1. **Curva React/Server Actions consume días sin commits útiles.** Mitigación: clonar el template `with-supabase-auth-realtime-db` de Vercel y modificarlo, no empezar de cero. Server Components al máximo, mínimo `'use client'`.
2. **Bug en el trigger de lock = pick post-kickoff = pelea por la guita.** Mitigación: tests SQL del trigger antes que cualquier UI. Log de intentos rechazados en `audit_log`.
3. **API de fútbol falla en pleno asado.** Mitigación: panel admin mobile-first listo en Día 8 (no Día 13). Calendario (fechas/equipos) NO depende de API — vive en DB seedeada.
4. **Supabase Free pausa proyectos inactivos a la semana.** Mitigación: cron job que pinguea cada 24h, o levantar el pago de Pro ($25/mes) durante el torneo.
5. **Whitelist de emails mal configurada → entra un random / queda afuera un amigo.** Mitigación: en Fase 5, validar lista con vos antes de mandar invitaciones.

### Decisiones abiertas (definir en PASO 0 antes de Fase 1)

- **Monto del pozo per cápita + moneda + plazo de pago**: ¿cuánto pone cada amigo? ¿ARS / USD? ¿Pago full antes del 11-jun o en cuotas?
- **Segundo admin de confianza**: email/nickname del segundo `role='admin'`. Va en el seed.
- **Goleador / MVP**: texto libre (default MVP — admin normaliza al final con búsqueda case-insensitive) o lista cerrada (require seed de ~700 jugadores).
- **Penalización por no cargar pick**: 0 pts (default) o pick automático "0-0 empate" / "1-1 empate" / similar.
- **Flujo de picks de knockout (CRÍTICO para el schema)**: los partidos de KO tienen placeholders (`home_placeholder='W-Group A'`, `away_placeholder='2nd-Group D'`) hasta que terminan los cruces. ¿Cómo se abren para que carguen los amigos?
  - Opción A (recomendada): picks de cada partido KO se **abren recién cuando se resuelven sus dos equipos** (admin cierra fase grupos → corre RPC que resuelve placeholders y setea `matches.status='scheduled'` para los partidos del cruce). Cada partido KO tiene su propio deadline = `lock_at` = `kickoff_at`. Esto requiere lógica de "resolución de cruces" en panel admin.
  - Opción B: picks de KO se cargan **anticipadamente sobre placeholders** (ej. "el ganador del Grupo A vs el segundo del D"). Más complejo de UI, más confuso para los amigos. No recomendado.
  - Opción C: bracket completo se carga **una sola vez al inicio del torneo** (tipo "completá tu bracket de antemano"). Mata el suspenso de los picks por partido en fase eliminatoria. No recomendado para este formato.
- **Tercer puesto activamos?**: Sugerencia: Campeón + Goleador + MVP + Subcampeón + Revelación (5 categorías). Si querés agregar Tercer Puesto suman 6.

### Decisiones tomadas (no abrir)

- Repo separado, no monorepo
- Stack: Next.js + Supabase + Vercel
- Auth: Google OAuth solo
- Visibilidad: al kickoff de cada partido individual
- Postgres (no SQLite/Turso)
- Resultados: ESPN no-oficial + API-Football free + manual override
- Modelo de scoring: configurable en DB, defaults del reglamento Cocos
- 5 categorías globales: Campeón, Goleador, MVP, Subcampeón, Revelación

---

## Verificación

Cómo confirmamos que cada fase está terminada:

| Fase | Verificación |
|---|---|
| Fase 0 | Login con Google en URL de Vercel → ver email del user en Supabase Dashboard |
| Fase 1 | `INSERT INTO match_predictions (...) WHERE match.lock_at < now()` → debe fallar con error de trigger. Audit log tiene la fila del intento. |
| Fase 2 | Cargar pick desde mobile real (no DevTools). Forzar el reloj del browser +1h y verificar que el form se deshabilita; intentar igual y ver que el server rechaza. |
| Fase 3 | Abrir leaderboard en 2 dispositivos. Admin finaliza un partido desde uno → el otro debería actualizar sin refresh. |
| Fase 4 | Cargar un resultado, finalizar, verificar puntos en `points_log`. Cambiar el resultado (admin override), ver audit log + recálculo automático. |
| Fase 5 | Lighthouse mobile score > 90 en `/matches`. PWA installable desde Chrome móvil. |
| End-to-end | Antes del 11-jun: ronda de prueba con 3 amigos cargando picks reales de partidos del fin de semana previo (amistosos preparación). |

### Tests automatizados mínimos (opcional pero recomendado)

- `tests/sql/lock_trigger.test.sql` — los 3 casos del trigger
- `tests/sql/scoring.test.sql` — exact_score, winner_correct, goal_diff con valores conocidos
- `tests/e2e/pick_flow.spec.ts` (Playwright) — login → cargar pick → ver historial. **Skip si aprieta el deadline.**

---

## Archivos críticos (referencia para implementación)

Del **nuevo repo** `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode-amigos\`:

- `supabase/migrations/0010_triggers.sql` — corazón de la auditoría con plata (enforce_prediction_lock)
- `supabase/migrations/0009_rls_policies.sql` — quién puede leer/escribir qué
- `src/app/matches/[matchId]/page.tsx` — Server Action del submit del pick
- `src/app/admin/results/page.tsx` — UI mobile del admin para cargar resultados
- `src/app/api/cron/poll-results/route.ts` — integración API fútbol (Fase 6)
- `scripts/seed_from_old_repo.py` — puente one-shot con los JSON del repo viejo
- `supabase/migrations/0012_rpcs.sql` — match_set_result, recalc, admin_view_predictions

Del **repo viejo** (solo lectura, para seed):

- `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode\research\simulacion\montecarlo.json` — 48 selecciones
- `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode\research\reglas\formato_mundial_2026.md` — fixture + grupos + fechas + sedes
- `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode\research\reglas\cocos_reglamento.md` — puntajes default por stage
- `C:\Users\matim\OneDrive\Escritorio\Proyectos\prode\output\data\libertadores_octavos-ida.json` — shape de referencia (kickoff_iso, espn_event_id)
