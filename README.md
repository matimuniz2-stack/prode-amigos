# Prode entre amigos · Mundial 2026

Web app de prode multi-usuario para jugar entre amigos durante el Mundial 2026 (11-jun → 19-jul 2026).

**El plan completo de implementación vive en [`PLAN.md`](./PLAN.md)** — es la fuente de verdad. Leerlo antes de tocar código.

## Stack

- Next.js 15 (App Router, TS) + Tailwind + shadcn/ui
- Supabase (Postgres + Auth Google OAuth + RLS)
- Vercel (hosting + cron)
- API resultados: ESPN no oficial (primaria) + API-Football (fallback) + override manual

## Setup local

1. **Crear proyecto Supabase** en https://database.new
2. **Copiar las keys** de `Settings → API` a `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
   ```
3. **Habilitar Google OAuth** en Supabase Dashboard → `Authentication → Providers → Google`
4. **Crear OAuth credentials** en Google Cloud Console y pegar Client ID + Secret en Supabase
5. **Correr dev server**:
   ```bash
   npm run dev
   ```
   App en `http://localhost:3000`

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server local |
| `npm run build` | Build producción |
| `npm run lint` | ESLint |

## Estructura

```
app/         Next.js App Router (RSC + Server Actions)
components/  UI components (shadcn en components/ui/)
lib/         Clientes Supabase, helpers, types
supabase/    Migrations + seed (próxima fase)
```

## Estado actual

**Fase 0 — Setup**: scaffolding desde template `with-supabase` de Vercel.

Próximas fases en `PLAN.md` §9 (Roadmap por fases).

## Deadline

11-jun-2026 — primer partido del Mundial. Hasta ahí: MVP en producción con todos los amigos invitados.
