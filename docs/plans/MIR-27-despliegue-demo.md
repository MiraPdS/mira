# Plan — MIR-27 · Despliegue del ambiente de demostracion

**Rama:** `feature/MIR-27-despliegue-demo` (desde `origin/develop`)
**Estimacion:** 5 pts · **Prioridad:** High
**Alcance:** config de infraestructura en el repo + un cambio chico de API
(`/api/health` toca la base) + documentacion. Las cuentas y secretos los
crea y pega una persona en los dashboards: el agente no crea cuentas ni
maneja credenciales.

## Criterios de aceptacion

Originales (el 4 se reescribe, ver decision 2):

1. Frontend desplegado en Vercel; la API se alcanza en `/api` del mismo origen.
2. API desplegada en **Render**, conectada al PostgreSQL de Supabase.
3. Migraciones aplicadas con `prisma migrate deploy`.
4. ~~CORS con origen exacto y cookies cross-site~~ -> **cookies de sesion
   funcionando (same-origin via rewrite, ver D13)**; `CORS_ORIGIN` igual se
   fija al origen exacto de Vercel como red de seguridad.

Definicion de terminado (se verifica contra las URLs reales y se deja
evidencia en el PR):

- [ ] `GET https://<web>.vercel.app/api/health` -> `200 { status: 'ok', db: 'ok' }`.
- [ ] Log de build de Render: `migrate deploy` sin pendientes y seed OK.
- [ ] Monitor de UptimeRobot verde >= 24 h.
- [ ] Login `ada@mira.dev` / `demo1234` en Chrome, Chrome incognito y Safari/iOS.
- [ ] `Set-Cookie` llega desde el dominio `vercel.app`, `HttpOnly; Secure`.
- [ ] F5 en `/projects/:id` no da 404; logout borra la sesion.
- [ ] D13 + D12 actualizada, README con URL, `docs/despliegue.md`, MIR-27
      reescrito en `backlog.md` y Jira.
- [ ] Pruebas de integracion de `/api/health` (base arriba / base caida -> 503).

Fuera de alcance: E2E (Entrega 3), staging separado, dominio propio, reset
de base para E2E.

## Lo que ya existe y se reutiliza

- `CORS_ORIGIN` como lista separada por comas con `credentials: true` (`app.ts`).
- Cookie `SameSite=None; Secure` en produccion (`lib/jwt.ts`): funciona igual
  siendo first-party, **no se toca**.
- `VITE_API_URL` en `lib/api-client.ts` (acepta ruta relativa `/api`).
- `DATABASE_URL` (pooler) + `DIRECT_URL` (migraciones) y `db:deploy`.
- `server.ts` ya maneja SIGTERM.
- `prisma/seed.ts` determinista e idempotente (`upsert` con `update: {}`).

## Decisiones

1. **API en Render** (free web service). Fly.io descartado: sin capa gratuita
   real y pide tarjeta. Actualizar D12.
2. **Same-origin via rewrite de Vercel (D13 nueva).** `vercel.app` y
   `onrender.com` estan en la Public Suffix List: la cookie cross-site seria
   de terceros y Safari (ITP), incognito de Chrome y Firefox (TCP) la
   bloquean o particionan. `apps/web/vercel.json` reescribe `/api/:path*` a
   Render y el build usa `VITE_API_URL=/api`. Actualizar los comentarios de
   `jwt.ts` y `vite.config.ts` que hablan de cross-site.
   - Las previews de PR tambien funcionan (mismo origen cada una). Un POST
     desde una preview manda un `Origin` que no esta en `CORS_ORIGIN`: no
     rompe nada, `cors` solo omite las cabeceras y el navegador no las mira
     en same-origin.
3. **Migraciones en el build command de Render** (el free tier no tiene
   pre-deploy). Si falla, falla el deploy y sigue la version anterior.
   - `npm ci --include=dev`: con `NODE_ENV=production` Render salta las
     devDependencies (prisma, tsup, tsx) y el build falla.
   - `DIRECT_URL` = **session pooler** de Supabase (`pooler.supabase.com:5432`),
     no `db.<ref>.supabase.co`, que es solo IPv6 y Render no sale por IPv6.
     Comentarlo en `.env.example`.
4. **Rama desplegada: `main`.** Render y Vercel produccion siguen `main`;
   previews de Vercel activas en PRs (apuntan a la misma API y a la base
   real: limitacion conocida, se documenta). Para validar antes de MIR-28:
   deploy manual de `develop` una vez desde cada dashboard.
5. **Seed en el build, tras migrar.** Garantiza usuarios y proyectos demo en
   cada deploy. Restaura lo borrado, no revierte ediciones (no es reset de
   E2E). Credenciales `demo1234` publicas a proposito: se dice en el README.
6. **Arranque en frio y pausa de Supabase.**
   - `/api/health` hace `SELECT 1` con Prisma: `{ status, db: 'ok' }` o 503.
   - `healthCheckPath: /api/health` en Render (un deploy sin base no queda vivo).
   - UptimeRobot (o cron-job.org) cada 10 min: mantiene despierta la API
     (~744 h de las 750 h/mes de la cuenta) y evita la pausa de 7 dias de
     Supabase. GitHub Actions cron descartado (atrasos, se apaga a los 60 dias).
7. **Infra como codigo.**
   - `render.yaml` (Blueprint) en la raiz: servicio `mira-api`, region
     `oregon`, branch `main`, sin `rootDir` (se instala el monorepo desde la raiz), build
     command de abajo, `startCommand: npm run start -w @mira/api`,
     `healthCheckPath`, `NODE_ENV=production`, `BCRYPT_ROUNDS=12`,
     `JWT_SECRET` con `generateValue: true`, `DATABASE_URL`/`DIRECT_URL`/
     `CORS_ORIGIN` con `sync: false`.
   - `apps/web/vercel.json`: rewrites en orden `/api/:path*` -> Render y
     `/(.*)` -> `/index.html` (fallback SPA para react-router).
   - Vercel: Root Directory `apps/web`, env `VITE_API_URL=/api`.
   - Supabase en `us-west-1` (cerca de `oregon`). Si ya existiera en otra
     region, Render se alinea a Supabase.
   - La URL de Render va literal en `vercel.json`: si `mira-api` esta tomado,
     copiar la real.
8. **Cuentas a nombre del responsable de MIR-27.** Equipo invitado a
   Supabase; `docs/despliegue.md` como runbook para recrear todo desde
   `render.yaml` en cuentas propias si hace falta.

Build command de Render:

```
npm ci --include=dev && npm run build -w @mira/api && npm run db:deploy -w @mira/api && npm run db:seed -w @mira/api
```

## Pasos

1. API: `/api/health` con `SELECT 1` + pruebas de integracion (ok y 503).
2. `render.yaml`, `apps/web/vercel.json`, comentario IPv6 en `.env.example`.
3. Comentarios de `jwt.ts` y `vite.config.ts` -> same-origin.
4. Docs: D13 y D12 en `decisiones-tecnicas.md`, `docs/despliegue.md`
   (runbook con cada variable, en que dashboard va, y pasos), README (URL,
   arranque en frio, credenciales demo), MIR-27 en `backlog.md`.
5. Manual (persona): crear Supabase -> Render Blueprint -> pegar secretos ->
   Vercel -> fijar `CORS_ORIGIN` -> UptimeRobot -> deploy manual de `develop`.
6. Recorrer la definicion de terminado y adjuntar evidencia al PR.
