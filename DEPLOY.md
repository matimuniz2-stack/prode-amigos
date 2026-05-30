# DEPLOY — pasos pendientes (acciones de Mati)

Todo el código está en producción (rama `main`). Lo que falta solo se puede
hacer desde tus cuentas de **Supabase** y **Google** (Claude no tiene acceso).
Orden recomendado:

## 1. Aplicar migraciones en Supabase
En la terminal del proyecto:

```bash
npx supabase login                                   # token de supabase.com/dashboard/account/tokens
npx supabase link --project-ref bhfsibyipezufgzxqaxm
npx supabase db push                                 # aplica TODAS las pendientes: 0017 tags · 0018 bracket · 0019 resolve_brackets · 0020 fix scoring KO · 0021 auto-random solo participantes · 0022 visibilidad · 0023 borrar globales · 0024 cerrar picks 5 min antes
npx supabase gen types typescript --linked > lib/types/database.ts
git add lib/types/database.ts && git commit -m "chore: regen tipos" && git push
```

> El último paso destraba el cableado de las **etiquetas** de jugadores.
> Avisá para terminarlas (editor en `/admin/participants` + chips en el ranking).

## 2. Verificar el cron de cierre (crítico para el 11-jun)
SQL Editor del dashboard de Supabase:

```sql
select jobname, schedule, active from cron.job;
```

Debe aparecer `lock_due_predictions` con schedule `* * * * *` y `active = true`.
Ese cron cierra los picks al kickoff y arma el pick al azar de los que no cargaron.

## 3. Que no pida login seguido
Supabase → **Authentication → Settings**:
- Subir **Access token (JWT) expiry** a `604800` (1 semana).
- Verificar que **Time-box user sessions** e **Inactivity timeout** estén desactivados.

## 4. Probar el flujo de eliminación
1. `/admin/results` → cargar resultado a los 6 partidos de un grupo y "Finalizar y puntuar".
2. `/admin/brackets` → "Resolver cruces" → verificar que llena el 1º/2º del grupo en sus llaves.
3. Los terceros se asignan cuando terminen los 12 grupos (pantalla de `/admin/brackets`).

## 5. Para invitar a los amigos
- Google Cloud → OAuth consent screen → **Test users** → agregar los Gmail de cada uno.
- **Antes de invitar**: sacar los logros/novedades de ejemplo del dashboard (`lib/demo-data.ts`).
- Mandar el link `https://www.prodelospibes.com` por WhatsApp.

## Fixes de auditoría (entran con el `db push` de arriba)
Las migraciones 0020-0023 corrigen bugs reales encontrados en la auditoría:
scoring de eliminación (acertar quién pasa por penales) + recalcular bien,
auto-random solo a participantes reales (no a todo el que se logueó),
visibilidad de picks por status del partido, y poder des-apostar globales.
Probar después del push (sobre todo cargar un pick de KO empatado → elegir
quién pasa, y finalizar/recalcular).

## Decisiones tomadas
- **Los picks cierran 5 min antes del kickoff** (migración 0024) — más anti-trampa.

## Deuda con fecha
- **Antes del 28-jun-2026** (dieciseisavos): validar la asignación de los 8 mejores terceros contra la tabla oficial FIFA.
- Rotar el Google Client Secret (está en logs viejos).
