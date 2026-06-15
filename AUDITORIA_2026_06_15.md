# Auditoría + Mejoras — Prode de los pibes (2026-06-15)

> Sesión arrancada por el quilombo del partido **Bélgica–Egipto (#37)**: estaba con el
> horario mal cargado (7pm en vez de 4pm), así que el lock quedó en el futuro y se podía
> editar el pick con el partido jugándose. Se frenó, se cargó el resultado real (1-1) y
> se finalizó. A partir de ahí Mati pidió: **re-auditar todo, re-chequear los horarios de
> los 104 partidos, y proponer 30-40 mejoras divertidas.** Esto es el entregable.

---

## 0) Qué onda — resumen en 30 segundos

- **Lo de hoy ya está resuelto y auditado.** Bélgica–Egipto quedó 1-1, finalizado, 9 picks
  puntuados, con asiento en `audit_log`. Nadie puede editar más. Decisión del grupo: valían
  los picks actuales (no se revirtió al de las 4pm). Grego tiene su cartelito **🤝 Fair-Play**.
- **El bug NO era de código, era de dato.** El manejo de zona horaria en el código está bien
  (usa `America/Argentina/Buenos_Aires` con `Intl`). El `kickoff_at` del #37 estaba cargado
  +3hs. ⇒ La auditoría de horarios es lo más importante de esta tanda (sección 2).
- **La auditoría de código encontró 2 cosas 🟠 para tocar antes de la próxima fecha en vivo**
  (corrección manual que ESPN pisa + falta de un "tripwire" que avise si un horario está mal),
  y 3 🟡 menores. El núcleo anti-trampa (privacidad de picks, lock, scoring) sigue sólido.
- **38 ideas divertidas** listadas y agrupadas en la sección 4, con esfuerzo estimado.

**Prioridad sugerida:** (1) terminar el cruce de horarios y corregir lo que aparezca →
(2) los 2 fixes 🟠 → (3) elegir 3-4 ideas 🟢 para tener listas para la próxima fecha.

---

## 1) Incidente #37 Bélgica–Egipto — qué se hizo

| Paso | Acción |
|---|---|
| Diagnóstico | `kickoff_at` estaba en `22:00 UTC` (19:00 ART = 7pm); real fue `19:00 UTC` (4pm). `lock_at` (21:55 UTC) quedaba en el futuro ⇒ editable con el partido jugándose. |
| Freno | `kickoff_at`→19:00 UTC, `lock_at`→18:55 UTC, `status`→live, `result_source`→manual. Edición cortada al toque. El cron de lock pasó los picks a `locked` y **no** generó auto-randoms (fuera de la ventana de 5 min). |
| Forensia | Reconstruí los picks pre-4pm con `match_prediction_history` (las transiciones de sistema no ensucian el historial). **OJO: `updated_at` quedó inservible** porque el lock lo bumpeó a todos. |
| Editaron post-kickoff | **Grego** (jugueteó pero terminó igual, 3-1) y **Matiii** (1-0 → 1-1, cambio real). |
| Cierre | Resultado 1-1 cargado + `calculate_match` ⇒ 9 picks puntuados. Asiento en `audit_log` a nombre del owner. Decisión del grupo: valen los picks actuales. |
| Joda | Tag **🤝 Fair-Play** a "Grego oprimido" en `profiles.tags`. |

---

## 2) Re-auditoría de HORARIOS (los 104 partidos)

**Por qué importa:** es exactamente lo que falló. Un `kickoff_at` mal cargado no lo agarra
nada del código — el lock simplemente nunca dispara y se puede editar el pick con el partido
en juego. Plata de por medio = esto tiene que estar 100%.

**Método:** bajé los 104 `kickoff_at`/`lock_at` de producción por la REST API (lectura
pública de `matches`) y los convertí a hora ART. En paralelo un subagente está armando el
calendario **oficial FIFA 2026** con los horarios reales en UTC para cruzarlos uno por uno.

**De dónde salió el error:** la migración `20260607093000_fix_real_match_dates.sql` cargó los
horarios de los 104 partidos a mano. Los **KO (#73-104)** los mapeó por número oficial FIFA, y
la **fase de grupos (1-72)** "desde ESPN", grupo por grupo. El #37 quedó ahí en `22:00Z` cuando
el real era `19:00Z`. Es un error a nivel fixture (slot válido, partido equivocado) — el tipo de
error que NO detecta ninguna validación estructural.

**Resultados del cruce (COMPLETO):**
- ✅ **KO (#73-104): los 32 dan PERFECTO** contra el calendario oficial FIFA 2026 (uno por uno).
- ✅ **Fase de grupos (1-72): 66 de 72 correctos.** Verificados por equipos contra las páginas
  oficiales por grupo de Wikipedia (hora local + offset UTC explícito) + FIFA.com / sitios de
  estadios. **6 estaban mal** (incluido el #37 ya arreglado) ⇒ **5 nuevos corregidos hoy.**
- ✅ Todos los `lock_at` quedan 5 min antes del `kickoff_at`.

**Los 5 horarios corregidos (aplicados en prod + migración `20260615210000`):**

| # | Partido | Tenía (UTC) | Real (UTC) | Error | Nota |
|---|---|---|---|---|---|
| 38 | IRN-NZL | 06-16 04:00 | **06-16 01:00** | +3h | ⚠️ se jugaba HOY 22:00 ART — mismo bug que el #37, evitado |
| 3 | MEX-KOR | 06-19 03:00 | **06-19 01:00** | +2h | futuro |
| 22 | TUR-PAR | 06-20 04:00 | **06-20 03:00** | +1h | futuro |
| 43 | ESP-CPV | 06-15 17:00 | **06-15 16:00** | +1h | ya jugado (0-0) — ver integridad ↓ |
| 15 | BRA-HAI | 06-20 01:00 | **06-20 00:30** | +30m | futuro |

**Patrón del error:** para varias sedes Pacific/Mexico se guardó la hora *wall-clock Eastern* de
las tablas de prensa como si fuera la local de la sede (#3 y #38 son los +2h/+3h). Lección: la
hora de prensa "9pm" sin la zona es veneno; siempre cargar desde la fuente con offset UTC explícito.

**Integridad del #43 (ya jugado con horario mal):** hubo ~55 min de ventana editable con el
partido en vivo. Revisé `match_prediction_history`: **el único que editó fue Grego** (16:34Z,
cambió 4-1 → 2-1), pero **sacó 0 puntos igual** (terminó 0-0 y él se quedó con "gana España").
**Cero impacto en el ranking — no hay nada que recalcular.**

**Recomendación estructural (ver también 🟠#2 de la sección 3):** agregar un *tripwire* que
avise fuerte si un partido tiene el `lock_at`/`kickoff_at` incoherente o si está jugándose
según ESPN pero el lock sigue en el futuro. El #37 falló en silencio; la próxima tiene que
fallar a los gritos.

---

## 3) Re-auditoría de CÓDIGO / DB

Núcleo anti-trampa: **sólido**. Privacidad de picks (sólo se ven con `lock_at <= now` y status
jugado), lock trigger, scoring idempotente y el poller de ESPN que no pisa resultados
finalizados/manuales — todo verificado y OK. Hallazgos accionables:

### 🟠 Para tocar antes de la próxima fecha en vivo

**🟠 #1 — La corrección manual de un resultado en vivo te la pisa ESPN.**
`match_set_result` hace `result_source = coalesce(result_source, 'manual')`
(`migrations/20260529080013_rpcs.sql:42`). Si el poller ya tocó un partido (`result_source='espn'`)
y después el admin corrige el marcador **sin finalizar** (ESPN lo tenía mal, lo arreglás en vivo),
el `coalesce` mantiene `'espn'` ⇒ al minuto siguiente el poller lo vuelve a pisar con el valor
de ESPN. La corrección no "pega".
**Fix:** que un set manual reclame siempre la propiedad → `result_source = 'manual'`
(incondicional) en `match_set_result`, o agregar un parámetro `p_source`.

**🟠 #2 — No hay guardia contra el tipo de error del #37.** Fue un error de dato y nada en el
código lo detecta. `lock_due_predictions` sólo crea auto-randoms en la ventana
`lock_at <= now() AND lock_at > now()-5min`: un partido con el `lock_at` mal-en-el-futuro
nunca lockea ni auto-randomiza, y falla **en silencio**.
**Fix (barato):** una query/cron de sanidad que alerte cuando `lock_at <> kickoff_at - 5min`,
o cuando un partido pasó su kickoff pero sigue `scheduled` con `lock_at > now()`. Un simple
reporte diario de "partidos con lock_at incoherente" hubiera cantado el #37.

### 🟡 Menores

- **🟡 #3 — La proyección en vivo mal-calcula los KO.** `lib/scoring.ts` espeja sólo la lógica
  de grupos (1X2 + exacto/diferencia). En los KO el acierto real es "quién pasa"
  (`predicted_ko_winner_team_id`), así que el "~+X si termina así" puede mostrar 0 a alguien
  que va a acertar. Es cosmético (nunca escribe puntos) pero en una noche de KO la gente lo lee
  como verdad. Pasarle la data de KO o esconder la proyección si `stageCode !== 'group'`.
- **🟡 #4 — "EN VIVO 0-0" antes de que el partido sea live de verdad.** `displayStatus`
  (`lib/matches.ts:106`) devuelve "live" sólo por `kickoff <= now`, sin mirar el status de la DB.
  Entre el kickoff y el primer poll de ESPN, la card muestra `0-0`. Mostrar el marcador sólo si
  `status === 'live'` (verdad de la DB).
- **🟡 #5 — El "movimiento ▲▼ desde la última fecha" usa la foto diaria, no "la última fecha".**
  El snapshot se toma todos los días 06:00 UTC / 03:00 ART. Un partido que finaliza **después**
  de las 03:00 ART entra en la foto de esa mañana y su cambio de puesto no se ve como movimiento.
  Con los kickoffs tardíos del Mundial (varios 01:00–04:00 ART), va a sub-reportar movimiento
  algunas noches. No es bug de plata (sólo la flechita); si lo querés exacto, snapshot por
  "fecha terminada" en vez de hora fija.

### ✅ Verificado OK (estaba en alcance)
Privacidad de picks / no se filtra el resultado antes de tiempo · el poller no pisa
finalizados ni manuales y banca el swap home/away · recalcular un partido finalizado re-puntúa
bien (idempotente) · el bypass de "transición de sistema" del lock no se puede usar para colar
una edición de contenido.

---

## 4) 38 mejoras divertidas

Esfuerzo: 🟢 fácil (sobre lo que ya existe, poco código) · 🟡 medio · 🔴 grande.
Muchas de las 🟢 se enganchan directo en `lib/badges.ts` (insignias automáticas) sin migración.

### A. Insignias nuevas (casi todas 🟢, en `lib/badges.ts`)
1. **🤝 Comité de Fair-Play (automática).** Convertir el chiste de Grego en sistema: si editaste
   tu pick a último momento (o después del kickoff, como pasó hoy), te ganás el cartelito.
   Sale gratis de `match_prediction_history`. Divertido **y** sirve de guardia social. 🟢
2. **🪦 El Fantasma.** No cargó ni un pick en toda una fecha. 🟢
3. **🐂 El Amarrete.** El de promedio de goles pronosticados más bajo (siempre 1-0, 0-0). 🟢
4. **🎆 El Tirabombas.** El de promedio más alto (siempre 4-3, partidos de básquet). 🟢
5. **🔮 El Brujo.** Clavó un exacto que casi nadie acertó (resultado improbable). 🟢
6. **🐑 El Borrego.** Sus picks coinciden con la mayoría casi siempre (va con la manada). 🟡
7. **🦄 El Rebelde.** El más contrarian: el que más veces fue contra la mayoría… y a veces pega. 🟡
8. **🎢 La Montaña Rusa.** El que más sube y baja de puesto entre fechas (usa los snapshots). 🟡
9. **⏰ El Colado.** Siempre carga sobre la hora (menor tiempo mediano pick→kickoff). 🟢
10. **🥶 Pecho de Hielo (automática).** 3+ fechas seguidas sin sumar (el opuesto de "En racha"). 🟢
11. **👑 Rey de la Fecha.** MVP de la jornada (más puntos esa fecha), corona temporal. 🟢
12. **💩 El Tortazo.** Peor pick de la fecha (el que más erró en goles en un partido). 🟢

### B. Social / chicana (🟡)
13. **💬 Cancha de comentarios.** Mini-feed por fecha o por partido (post-lock) para chicanearse. 🟡
14. **🔥 Botón de chicana.** Reacciones rápidas (🤡 📉 🐐) a picks ajenos una vez cerrados. 🟡
15. **🎤 Frase de la semana.** El admin (o auto) destaca la mufa/cague de la fecha en el dashboard. 🟢
16. **🥊 Duelos ("Tu pelea" 2.0).** Head-to-head con un rival elegido: historial, quién ganó más fechas. 🟡
17. **📊 La Grieta.** Por partido, mostrar el % del grupo que fue a cada lado (al cerrar): "8/9 a Bélgica". 🟢
18. **📰 El Diario del Prode.** Recap automático con titular generado: "Tochh hizo la fecha perfecta;
    Mati editó tarde y zafó por un pelo". 🟡

### C. Estadísticas / data (🟡)
19. **🧠 Tu ADN futbolero.** Perfil del jugador: equipo que más banca, resultado que más repite,
    goles promedio, % de empates. 🟡
20. **🏆 Vitrina de logros.** Página con todas las insignias ganadas (históricas, con fecha). 🟡
21. **📈 Gráfico de la carrera.** Línea de puntos acumulados por fecha de cada jugador (tipo standings de F1). 🟡
22. **🎯 Precisión por categoría.** Cuánto acertás en 1X2 vs exacto vs globales. 🟢
23. **🌡️ Termómetro del pozo.** Cuánto vale y cuánto "se movió", barra de presión a medida que avanza. 🟢
24. **🗓️ Tu agenda.** Próximos partidos con countdown y si ya cargaste o no. 🟢

### D. En vivo (🟡–🔴)
25. **🔴 Sala en vivo.** Pantalla dedicada durante los partidos: marcador + proyección de puntos
    de todos en tiempo real, quién sube y baja. 🔴
26. **⚡ "Se viene el cierre".** Push 15 min antes del lock si no cargaste (la PWA ya es instalable). 🟡
27. **🎬 Repetición de la fecha.** Animación del ranking reordenándose cuando entran los resultados. 🟡
28. **📺 Segunda pantalla.** Mientras mirás el partido, ves tu proyección actualizarse gol a gol. 🟡

### E. Gamificación / mini-juegos (🟡–🔴)
29. **🎟️ Comodín x2.** 1-2 veces en el torneo elegís un partido donde tus puntos valen doble
    (hay que activarlo antes del lock). Mete estrategia. 🟡
30. **🧨 Bonus de la fecha.** Pregunta extra por jornada ("¿habrá roja?", "¿gol de tiro libre?")
    que suma aparte. 🟡
31. **🤖 El Muñeco (rival bot).** Un jugador fantasma que siempre pone el favorito; si no le ganás,
    vergüenza eterna. 🟡
32. **🎰 Over/Under de la fecha.** Apuesta interna a los goles totales de la jornada. 🟡
33. **🔥 Racha multiplicadora.** Si venís "En racha", el próximo acierto vale un cachito más. 🟡

### F. Premios / ceremonia (🟢–🟡)
34. **🏆 Ceremonia final.** Pantalla de cierre con podio animado, premios y menciones especiales
    (las mejores y peores insignias del torneo). 🟡
35. **💸 Reparto del pozo visible.** Quién se lleva cuánto según el reparto configurado, con cuenta
    regresiva al final. 🟢
36. **📜 Acta de campeón.** Imagen compartible (story de IG/WhatsApp) con el campeón y sus stats. 🟡

### G. Integridad con onda (🟢–🟡)
37. **🕵️ VAR del Prode.** Registro público (post-lock) de "este pick se editó X veces / a último
    momento", con humor. Transparencia total = menos quilombo. Engancha con lo de hoy. 🟢
38. **🔒 Sello "cargado a tiempo".** Chip verde discreto en los picks cargados con tiempo
    (lo contrario al Fair-Play). 🟢

---

## 5) Próximos pasos sugeridos
1. **Terminar el cruce de horarios** (sección 2) y corregir en prod lo que aparezca — es lo más
   urgente porque es plata y ya falló una vez.
2. **Aplicar los 2 fixes 🟠** (corrección manual que pega + tripwire de horarios) antes de la
   próxima fecha en vivo. Tengo el SQL/diff listo cuando digas.
3. **Elegir 3-4 ideas 🟢** para sumar ya (mi combo recomendado: #1 Fair-Play auto, #11 Rey de la
   Fecha, #17 La Grieta, #37 VAR del Prode — todas baratas y muy en el espíritu del grupo).
