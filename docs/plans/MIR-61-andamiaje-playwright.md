# Plan — MIR-61 · Andamiaje de Playwright

**Rama:** `test/MIR-61-andamiaje-playwright` (desde `develop`, después de
fusionar el PR del plan de la Entrega 3, `docs/MIR-75-plan-entrega-3`)
**PR:** uno solo, base `develop`
**Estimación:** 5 pts · **Prioridad:** Highest · **Responsable:** Benjamín
**Por qué es urgente:** desbloquea las ocho specs del equipo (MIR-63 a MIR-70)
y el job de CI (MIR-62). Hay que fusionarlo en uno o dos días.

Fuente: [`docs/backlog.md` §MIR-61](../backlog.md) y
[`plan-trabajo-entrega3.md`](../plan-trabajo-entrega3.md).

## Criterios de aceptación (backlog)

1. Existe `e2e/` con un `playwright.config.ts` que lee `BASE_URL` del entorno
   (por defecto `http://localhost:4173`). Ninguna spec fija la URL a mano.
2. Proyectos `chromium` (desktop) y `mobile` (375 px), siempre headless en CI.
3. `globalSetup` hace `migrate reset` + seed una vez, y un proyecto `setup`
   guarda el `storageState` de ada, alan y grace.
4. El fixture `proyectoPropio` crea por API un proyecto con clave única.
5. `trace: 'retain-on-failure'`, screenshot y video solo al fallar,
   `retries: 0`, y reporters `html` y `junit`.
6. `npm run test:e2e` levanta la API y la web (`webServer`) y corre la suite en
   local. Queda documentado en el README.
7. Una spec de ejemplo (abrir `/login`) pasa en local.

## Lo que ya existe y se reutiliza

- `docker-compose.yml`: `db-dev` (5442, `mira_dev`) y `db-test` (5443,
  `mira_test`, en RAM). La suite de integración hace `TRUNCATE` en `mira_test`.
- `apps/api/prisma/seed.ts`: determinista e idempotente. Crea ada (OWNER),
  alan (MEMBER) y grace (VIEWER) en el proyecto `MIR`, todos con la contraseña
  `demo1234`. Carga el `.env` de la raíz con `dotenv`, que no pisa las
  variables ya definidas.
- `apps/web/src/lib/api-client.ts:25`: un build de producción sin
  `VITE_API_URL` usa `/api` relativo.
- `apps/api/src/env.ts`: `CORS_ORIGIN` (por defecto `:5173`). La cookie es
  `sameSite: 'lax'` (`lib/jwt.ts`).
- `POST /api/auth/login` y `POST /api/projects`: el creador queda como OWNER y
  `projects.repository.ts` crea las columnas por defecto.
  `projectKeySchema`: de 2 a 8 caracteres, empieza con letra, alfanumérica, en
  mayúsculas.
- `vitest.config.ts` de la raíz: solo carga los configs de `packages/shared` y
  `apps/*`, así que no levanta specs de `e2e/`.
- `ci.yml` (MIR-51): Vitest escribe su JUnit en `test-results/junit.xml` de la
  **raíz** y lo sube como artefacto `reporte-junit`.

## Decisiones (grill del 2026-11-18)

### D1 — Base de datos `mira_e2e` en el contenedor `db-test` (5443)

`postgresql://mira:mira@localhost:5443/mira_e2e`. No toca `mira_dev` ni choca
con el `TRUNCATE` de la integración. No requiere cambios en
`docker-compose.yml`, porque `prisma migrate reset` crea la base si no existe.
En CI es la base del `services:` del job E2E.

### D2 — Mismo origen: proxy `/api` en `vite preview`

`vite.config.ts` agrega `preview.proxy` de `/api` hacia
`http://localhost:${E2E_API_PORT ?? 3000}`. La web se buildea **sin**
`VITE_API_URL`. Replica el rewrite de Vercel (D13): cookie first-party y sin
CORS. `BASE_URL` es el único origen, y MIR-72 lo reutiliza contra la demo. Un
`npm run preview` manual sigue apuntando a la API de dev (3000).

### D3 — `webServer` según el entorno

| Entorno | API (puerto 3100) | Web (4173) |
| --- | --- | --- |
| Local | `tsx src/server.ts` | `vite build && vite preview --port 4173 --strictPort` |
| CI (`CI=true`) | `node dist/server.js` | `vite preview` sobre el `dist` |
| `BASE_URL` definido desde afuera | no se levanta nada | no se levanta nada |

- La API de E2E corre en **3100**, con `DATABASE_URL=…/mira_e2e`, y el
  `webServer` de la web le pasa `E2E_API_PORT=3100`. Así nunca reutiliza por
  error la API de dev conectada a `mira_dev`.
- **Para MIR-62** (revisión del PR #61): con `CI=true` el config no compila
  nada, y los jobs de Actions no comparten archivos. El job `E2E` tiene que
  correr `npm run build` él mismo, **sin `VITE_API_URL`**, antes de
  Playwright. No sirve reutilizar el job `Build` tal como está: no sube
  artefactos y compila la web con `VITE_API_URL=http://localhost:3000/api`,
  así que el bundle se salta el proxy de D2.
- `reuseExistingServer: !process.env.CI` **solo para la API**. La web nunca
  se reutiliza: un `npm run preview` manual en :4173 reenvía `/api` a la API
  de desarrollo, y los tests escribirían en `mira_dev` (revisión del PR #61).
- Playwright levanta los servidores y **espera a que respondan** antes de
  correr `globalSetup`. Por eso la API se espera por **puerto** y no por
  `/api/health`: el health consulta la base, y la primera vez `mira_e2e` no
  existe hasta que el `globalSetup` la crea (se quedaba esperando hasta el
  timeout). El reset con la API ya conectada funciona, porque en Postgres
  `migrate reset` hace `DROP SCHEMA` y no borra la base.

### D4 — Sesiones por API en el proyecto `setup`

- `auth.setup.ts` hace `request.post('/api/auth/login')` contra `BASE_URL` y
  guarda `e2e/.auth/{ada,alan,grace}.json` (en `.gitignore`).
- `fixtures/usuarios.ts` exporta `{ ada, alan, grace }` con correo, contraseña
  y ruta del storage. Las specs usan
  `test.use({ storageState: usuarios.grace.storage })`.
- `setup` es dependencia de `chromium` y `mobile`. El login por UI se prueba
  en MIR-63.

### D5 — Fixture `proyectoPropio`

- Lo crea `page.request`, que comparte cookies con el `storageState` del test:
  el dueño es quien esté logueado (por defecto ada).
- Clave: `'E'` + 7 caracteres aleatorios base36 en mayúsculas. Nombre:
  `E2E <título del test>`.
- Devuelve `{ id, key, name, url }`, donde `url` es la ruta del backlog del
  proyecto.
- **Sin teardown:** D1 resetea la base en cada ejecución, y así el trace
  conserva la evidencia.
- No agrega miembros: la spec que los necesite llama a
  `POST /projects/:id/members`.
- Con `BASE_URL` externa **lanza un error**, así las specs de humo (MIR-72)
  no pueden crear datos en la demo, aunque alguien lo intente (revisión del
  PR #61).

### D6 — Proyecto `mobile` por etiquetas

- `mobile`: `grep: /@movil/`. `chromium`: `grepInvert: /@solo-movil/`.
- Dispositivo: chromium con `viewport: { width: 375, height: 812 }`,
  `isMobile: true` y `hasTouch: true`. Sin presets que arrastren WebKit.

### D7 — Workspace `@mira/e2e`

```
e2e/
  package.json  tsconfig.json  playwright.config.ts  README.md
  global-setup.ts          # migrate reset + seed sobre mira_e2e
  auth.setup.ts            # proyecto setup (D4)
  fixtures/{index,usuarios,proyecto}.ts
  specs/ejemplo.spec.ts    # abrir /login
  .auth/  playwright-report/  reportes/  test-results/   ← .gitignore
```

- `"e2e"` se agrega a `workspaces`. El `tsconfig` extiende
  `tsconfig.base.json`, y el script `typecheck` hace que el `npm run typecheck`
  de la raíz cubra las specs.
- Scripts de la raíz: `test:e2e` y `test:e2e:ui`.
- `@playwright/test` con **versión exacta** (sin `^`).
- `eslint-plugin-playwright` queda como mejora futura.

### D8 — Convenciones para las specs (van en `e2e/README.md`)

1. Selectores: `getByRole`/`getByLabel`, después `getByText` y al final
   `getByTestId`. Sin CSS ni XPath.
2. `data-testid` en kebab-case y en español (`tarjeta-elemento`), solo si no
   hay rol o nombre accesible.
3. Solo `expect` con reintento automático. Prohibido `waitForTimeout`.
4. `fullyParallel: true`. Lo que escribe usa `proyectoPropio`, y `MIR` es solo
   lectura. `workers: 2` en CI.
5. Timeouts por defecto (30 s el test y 5 s el `expect`), sin subirlos.
   `retries: 0`.
6. Nombres en español. Un `describe` por historia:
   `describe('MIR-11 · Crear elemento', …)`.
7. `test` y `expect` se importan siempre desde `e2e/fixtures`.

### D9 — Reportes y evidencia

| Qué | Ruta | Artefacto en MIR-62 |
| --- | --- | --- |
| Consola | reporter `list` | log del job |
| HTML | `e2e/playwright-report/` (`open: 'never'` en CI, `'on-failure'` local) | `reporte-e2e` (siempre) |
| JUnit | `e2e/reportes/junit-e2e.xml` | `reporte-junit-e2e` (siempre) |
| Traces, screenshots, videos | `e2e/test-results/` (`outputDir`) | `evidencia-fallos-e2e` (si falla) |

El JUnit va fuera de `playwright-report/` porque el reporter HTML vacía su
carpeta. El `outputDir` queda explícito, porque Playwright lo borra al
arrancar y no puede apuntar al `test-results/` de la raíz (JUnit de Vitest).

## Problemas encontrados (para la Wiki, Anexo B §7)

1. **El `webServer` esperaba a `/api/health` y nunca arrancaba.** Playwright
   espera a los servidores antes del `globalSetup`, y el health fallaba porque
   `mira_e2e` todavía no existía. Solución: esperar el puerto (D3).
2. **Prisma bloquea `migrate reset` cuando lo ejecuta un agente de IA.** Desde
   Prisma 6.x, el CLI detecta Claude Code y pide el consentimiento explícito
   del usuario en `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. A las personas
   ni a GitHub Actions no les afecta. Al implementar con un agente, se le
   autoriza explícitamente el reset de `mira_e2e`.
3. **El backlog no muestra el nombre del proyecto.** La primera versión de la
   spec de ejemplo lo buscaba y falló. Ahora verifica el encabezado `Backlog`
   y el enlace "Volver al proyecto" con el id.
4. **Cliente de Prisma desactualizado en local.** `npm run typecheck` falló
   en la API (`boardColumn`, `Sprint`) hasta correr
   `npm run db:generate -w @mira/api`. Después de un `git pull` que trae
   migraciones, hay que regenerar el cliente.

## Pasos

1. Pushear `docs/MIR-75-plan-entrega-3` y abrir su PR a `develop`.
2. Limpiar el working tree de `feature/MIR-33-ci-cd-actions`. Después,
   `git switch develop && git pull` y crear
   `test/MIR-61-andamiaje-playwright`.
3. Crear el workspace `e2e/` (D7) e instalar `@playwright/test` con versión
   exacta y chromium.
4. Agregar `preview.proxy` en `apps/web/vite.config.ts` (D2).
5. Escribir `playwright.config.ts` (D3, D6, D8.4–5, D9), `global-setup.ts` (D1),
   `auth.setup.ts` y `fixtures/` (D4, D5).
6. Escribir `specs/ejemplo.spec.ts` (abrir `/login`).
7. Actualizar `.gitignore`, los scripts de la raíz, `e2e/README.md` (D8) y la
   sección "Pruebas E2E" del `README.md` de la raíz.
8. Verificar: `npm run test:e2e` en verde tres veces seguidas; `npm test` sin
   cambios en el número de archivos; `npm run typecheck`, `npm run lint` y
   `npm run format:check`.
9. Anotar en `docs/wiki/Entrega-3.md` §Problemas cualquier tropiezo que
   aparezca.
10. Abrir el PR a `develop` con la clave `MIR-61`.
