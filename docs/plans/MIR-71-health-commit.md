# Plan — MIR-71 · Commit desplegado en `/api/health`

**Rama:** `ci/MIR-71-health-commit` (desde `develop`)
**PR:** uno solo, base `develop`
**Estimación:** 2 pts · **Prioridad:** High · **Responsable:** Benjamín
**Alcance:** router del health y su prueba de integración, `env.ts`, `app.ts`,
el paso de espera del job `Desplegar` en `ci.yml`, `docs/ci-cd.md` y
`docs/despliegue.md`. El agente no toca secretos, Render, Vercel ni la
protección de ramas. La verificación real ocurre en el release MIR-76.

Fuente: [`docs/backlog.md` §MIR-71](../backlog.md),
[`docs/ci-cd.md` §Qué verifica el job](../ci-cd.md#qué-verifica-el-job) y
[`MIR-54-deploy-actions.md`](./MIR-54-deploy-actions.md) (decisión "Un 200 no
prueba la versión nueva"). Pendiente desde la Entrega 2. El criterio 3 está
en Jira ([`jira-import.csv`](../jira-import.csv)), pero no en `backlog.md`: lo
señaló la revisión del PR #71.

## Criterios de aceptación (Jira)

| # | Criterio | Verificación en el PR | Verificación posterior (release MIR-76) |
| --- | --- | --- | --- |
| 1 | `/api/health` responde el commit que está corriendo, además del estado | Pruebas de integración nuevas (D5) en `Lint, tipos y pruebas` | `https://mira-pds.vercel.app/api/health` responde `commit` igual al merge commit del tag |
| 2 | "Comprobar que la API responde" espera a que ese commit coincida con `github.sha` y falla si se agota el tiempo | Lectura de `ci.yml`. El `run:` se ejecuta tal cual contra un servidor local, con los casos de D5. `Desplegar` queda _Skipped_ en el PR y en `develop` | `Desplegar` verde con `La API corre <sha>`, y el log muestra intentos previos con `commit null` o el commit anterior |
| 3 | Pendiente de la Entrega 2 cerrado en la Wiki | `docs/wiki/Entrega-2.md` marca las dos menciones como resueltas en la Entrega 3, con enlace al PR | La Wiki publicada muestra la anotación después de fusionar |

## Lo que ya existe

- **[`health.router.ts`](../../apps/api/src/modules/health/health.router.ts)
  (MIR-27):**
  - `GET /api/health/live` es el liveness sin base que usa Render
    (`healthCheckPath`).
  - `GET /api/health` hace `SELECT 1` con timeout y abandono. Lo usan
    UptimeRobot y el job.
  - Los dos devuelven `status`, `timestamp` y, en el segundo, `db`.
    `createHealthRouter` ya recibe opciones (`dbTimeoutMs`, `dbAbandonMs`).
- **[`health.integration.test.ts`](../../apps/api/src/modules/health/health.integration.test.ts):**
  combina `createApp()` con mini-apps con opciones, contra la base de `db:up`.
- **[`env.ts`](../../apps/api/src/env.ts):** esquema Zod. Hoy no lee nada de
  Render. [`setup-env.ts`](../../apps/api/src/test/setup-env.ts) no define
  `RENDER_GIT_COMMIT`.
- **Render:** define `RENDER_GIT_COMMIT` (sha completo) en build y en runtime.
  El hook ya lleva `ref=$GITHUB_SHA`, así que se pide desplegar exactamente el
  commit del run. Fuera de Render (local, CI y E2E) la variable no existe.
- **E2E** no consulta el health: espera el puerto
  ([`playwright.config.ts:104`](../../e2e/playwright.config.ts)).
- **Job `Desplegar`:** `HEALTH_URL` apunta al dominio de Vercel. Hoy espera
  3 min y luego consulta cada 15 s, con 20 s por intento y 15 min de tope; se
  conforma con el primer 200. Tiene `timeout-minutes: 25`. `jq` viene en
  `ubuntu-latest`.
- **`apps/web/vercel.json`:** el rewrite `/api/:path*` va a Render. El health
  que ve el job es el de Render pasando por Vercel.
- **El repositorio es público:** el sha no revela nada que no esté en GitHub.

## Decisiones (grill del 2026-11-19)

### D1 — Origen: `RENDER_GIT_COMMIT` opcional en `env.ts`

Se agrega `RENDER_GIT_COMMIT: z.string().optional()` al esquema. Si falta, el
health responde `commit: null`. Así no se rompe nada en local, CI ni E2E, y se
mantiene la convención de leer el entorno solo a través de `env.ts`. Se
descartan leer `process.env` en el router, una variable propia `GIT_COMMIT` y
un literal `'dev'`.

### D2 — Formato: `commit` con el sha completo, en los dos endpoints, público

- `/api/health` → `{ status, db, commit, timestamp }`, también en el 503.
- `/api/health/live` → `{ status, commit, timestamp }`. Sirve para revisar a
  mano la versión aunque la base esté caída.
- Sha completo (40 caracteres): el job compara por igualdad exacta con
  `GITHUB_SHA`.
- Sin protección: el repo es público. Render solo mira el código de estado.

### D3 — Espera del job: commit contra `GITHUB_SHA`, sin espera inicial, 20 min

Paso renombrado a **`Comprobar que la API corre el commit desplegado`**:

- Sin `sleep` inicial (`ESPERA_INICIAL_S` desaparece). El 200 de la versión
  anterior ya no da verde: se registra y se sigue esperando.
- `INTERVALO_S: '15'`, `--max-time 20` por intento, `TOPE_S: '1200'`.
  `timeout-minutes: 25` sigue alcanzando, porque los pasos previos son
  segundos. Se actualiza su comentario.
- Éxito: HTTP 200 **y** `commit == GITHUB_SHA`. `commit` se extrae del cuerpo
  con `jq -r '.commit // empty'`. Un cuerpo que no es JSON cuenta como sin
  commit, sin romper el script.
- Log por intento: `Intento 7: HTTP 200, commit 1a2b3c4 (se espera 9f8e7d6)`.
  Si no hay 200: `Intento 7: HTTP 504`.
- Mensajes finales:
  - éxito: `::notice::La API corre <sha> (intento n)`;
  - tope con 200 de otro commit:
    `::error::La API sigue en <sha> tras 20 min: el despliegue de Render no terminó o falló. Revisa el panel de Render`;
  - tope con `commit` nulo o ausente:
    `::error::La API responde pero no informa su commit (¿falta RENDER_GIT_COMMIT?)`;
  - tope sin ningún 200: el mensaje de hoy, con el nuevo tope.
  El mensaje lo decide la **última** respuesta recibida.
- Igual que hoy: la URL entra por `env`, no hay `set -x` y no se imprime el
  cuerpo completo.

### D4 — Vercel queda fuera; `Cache-Control: no-store` en el health

El `commit` es el de Render: prueba la API nueva y que el rewrite llega a ella,
no que Vercel terminó su build. El hook de Vercel construye la punta de `main`,
y la guarda de la punta asegura que sea `GITHUB_SHA`. Que ese build termine bien
se sigue viendo en el panel de Vercel. Verificar el frontend (por ejemplo,
`version.json` con `VERCEL_GIT_COMMIT_SHA`) sería otro ítem.

Los dos endpoints responden `Cache-Control: no-store` (también en el 503), para
que ningún CDN sirva una versión vieja.

### D5 — Pruebas

- **Commit inyectado:** `createHealthRouter({ commit })`, con `null` por
  defecto. `app.ts` pasa `env.RENDER_GIT_COMMIT ?? null`. El router no lee
  `env`, y la prueba no toca `process.env` ni recarga módulos.
- **Nuevas en `health.integration.test.ts`:**
  1. Mini-app con `commit: '<40 hex>'`: `/api/health` y `/api/health/live`
     responden ese `commit`.
  2. `createApp()` sin `RENDER_GIT_COMMIT`: los dos responden `commit: null`.
  3. Los dos responden `Cache-Control: no-store`, también en el 503.
  4. La prueba del 503 se amplía para comprobar que trae `commit`.

  Las pruebas 1 a 3 simulan el `SELECT 1`: después de que otra prueba espía y
  restaura `prisma.$queryRaw`, el cliente de Prisma deja de exponerlo como
  función (la consulta real colgaba 20 s).
- **Script del job:** no lleva prueba commiteada. Como en MIR-54, el `run:` se
  ejecuta tal cual con `bash`, contra un servidor local de prueba, con
  `TOPE_S` e `INTERVALO_S` bajos. Casos:
  - commit correcto al primer intento → verde;
  - commit viejo y luego el nuevo → verde en el intento 2+;
  - commit viejo hasta el tope → rojo, mensaje de despliegue no terminado;
  - `commit: null` hasta el tope → rojo, mensaje de `RENDER_GIT_COMMIT`;
  - 503 o conexión rechazada hasta el tope → rojo, mensaje sin 200;
  - cuerpo no JSON con 200 → no rompe y sigue esperando.

### D6 — Documentación

- **`docs/ci-cd.md`:**
  - Tabla de "Despliegue": la fila del paso con su nombre nuevo, la consulta
    desde el disparo y el rojo si en 20 min no hay 200 con
    `commit == GITHUB_SHA`.
  - "Qué verifica el job" se reescribe. Verde significa que la API corre
    exactamente el commit del run y que el rewrite y la base contestan. Verde
    **no** significa que Vercel terminó su build (panel de Vercel). Se elimina
    "Cerrar ese hueco requiere…".
  - "Consecuencias":
    - "El frontend puede adelantarse a la API": si el build de Render falla,
      el job ahora queda **rojo**, aunque el frontend nuevo ya esté publicado
      contra la API anterior.
    - "Serie en GitHub no significa serie en Render" se simplifica: el job no
      termina hasta que el despliegue de Render salió.
    - Se revisan las demás menciones al "primer 200".
- **`ci.yml`:** comentarios del paso y de `timeout-minutes`.
- **`docs/despliegue.md`:** en "Dos health checks", que los dos responden
  `commit` (`null` fuera de Render). En la checklist, que `commit` coincida con
  el commit de `main`.
- **`wiki/Entrega-2.md` (criterio 3, tras la revisión del PR):** las dos
  menciones al hueco se **anotan** como resueltas en la Entrega 3, con enlace a
  MIR-71. No se borran, para no reescribir la historia de esa entrega.
- **No se tocan:** los planes anteriores, que son historia, ni `backlog.md`.
  La wiki de la Entrega 3 se actualiza en MIR-76.

### D7 — Verificación real en el release MIR-76

El código corre por primera vez en un push a `main`. En ese release el script
nuevo le pega mientras tanto a la API vieja, que no trae `commit`: lo lee como
`null` y sigue esperando hasta que sale la nueva. No hace falta preparar nada
antes.

- Evidencia: `Desplegar` verde con `La API corre <sha>`, el log con intentos
  previos sin coincidencia, y `/api/health` abierto a mano con `commit` igual
  al merge commit del tag. El run se enlaza en este plan.
- Sin prueba negativa en producción: los rojos los cubre D5.
- **Riesgo:** si Render no definiera `RENDER_GIT_COMMIT` en runtime, el job
  quedaría rojo por tope con el mensaje de D3, aunque el despliegue esté bien.
  En ese caso se confirma en el panel de Render y se corrige con un hotfix, sin
  revertir el release. Render documenta la variable en runtime, así que el
  riesgo es bajo.

## Pasos

1. `git switch develop && git pull` y crear `ci/MIR-71-health-commit`.
2. `env.ts`: `RENDER_GIT_COMMIT` opcional (D1).
3. `health.router.ts`: opción `commit`, el campo en las tres respuestas, y
   `Cache-Control: no-store` (D2, D4). Actualizar el comentario de cabecera.
   `app.ts`: pasar `env.RENDER_GIT_COMMIT ?? null`.
4. `health.integration.test.ts`: las pruebas de D5.
5. `ci.yml`: renombrar el paso, quitar `ESPERA_INICIAL_S`, `TOPE_S: '1200'`, el
   script y los mensajes de D3, y los comentarios.
6. Ejecutar el `run:` en local contra un servidor de prueba con los seis casos
   de D5, y anotar el resultado en el PR.
7. `docs/ci-cd.md` y `docs/despliegue.md` (D6).
8. Verificar en local: `npm run format:check`, `npm run lint`, `npm run typecheck`
   (si existe) y `npm run test -w @mira/api` con `db:up`.
9. Commits convencionales en español con la clave MIR-71, y PR a `develop`. En
   el CI del PR: los tres checks en verde y `Desplegar` _Skipped_.
10. Revisión cruzada y fusión en `develop`.
11. ~~**Benjamín, en el release MIR-76:** la evidencia de D7, y enlazar el run
    aquí.~~ Hecho en el [run 45537008110](https://github.com/MiraPdS/mira/actions/runs/45537008110) de `main` (merge commit `6bd4016` del
    [PR #81](https://github.com/MiraPdS/mira/pull/81)): `Desplegar` en verde;
    los intentos 1 a 7 respondieron sin `commit` (la API anterior) y el 8
    registró `La API corre 6bd401677780c2b818fdc9cb9ec4abc67c406533`. `/api/health` abierto a mano responde
    `"commit":"6bd401677780c2b818fdc9cb9ec4abc67c406533"`. No hizo falta el hotfix del riesgo de D7.

## Fuera de alcance

- Verificar que Vercel publicó el frontend nuevo (D4): otro ítem si se quiere.
- Usar `RENDER_API_KEY` o la API de Render para leer el estado del deploy.
- Humo E2E contra la demo: MIR-72.
- Node 24 en las actions: MIR-73.
