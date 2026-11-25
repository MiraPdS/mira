# Plan — MIR-72 · Humo E2E contra la demo desplegada

**Rama:** `ci/MIR-72-humo-e2e` (desde `develop`)
**PR:** uno solo, base `develop`
**Estimación:** 2 pts · **Prioridad:** Medium · **Responsable:** Benjamín
**Alcance:** `e2e/playwright.config.ts`, `e2e/entorno.ts`, una spec nueva
`e2e/specs/humo.spec.ts`, `apps/web/vite.config.ts` (meta con el commit),
los jobs `humo` y `notify` de `ci.yml`, `docs/ci-cd.md` y `e2e/README.md`. El
agente no toca secretos, Render, Vercel ni la protección de ramas. La
verificación real ocurre en el release MIR-76.

Fuente: [`docs/backlog.md` §MIR-72](../backlog.md),
[`jira-import.csv`](../jira-import.csv) (bloque MIR-72),
[`docs/ci-cd.md` §Despliegue y §Notificaciones](../ci-cd.md#despliegue),
[`MIR-61-andamiaje-playwright.md`](./MIR-61-andamiaje-playwright.md) (D3:
`BASE_URL` externa no levanta servidores ni resetea),
[`MIR-62-job-e2e-actions.md`](./MIR-62-job-e2e-actions.md) (artefactos y topes
por paso) y [`MIR-71-health-commit.md`](./MIR-71-health-commit.md) (espera por
commit). Va en la cadena crítica `MIR-62 → MIR-72 → MIR-76 → MIR-77`.

## Criterios de aceptación (Jira)

Jira agrega en el criterio 2 que los tests "no crean ni modifican datos", algo
que `backlog.md` no dice explícitamente.

| # | Criterio | Verificación en el PR | Verificación posterior (release MIR-76) |
| --- | --- | --- | --- |
| 1 | Job `Humo E2E` en `main` después de `Desplegar`, con `BASE_URL` de la URL pública | Lectura de `ci.yml` (`needs: deploy`, mismo `if`). El job queda _Skipped_ en el PR y en `develop` | `Humo E2E` corre después de `Desplegar` en el run del merge a `main` |
| 2 | Dos tests de solo lectura etiquetados `@humo`: login con la cuenta de demo y abrir el tablero de `MIR`. No crean ni modifican datos | Pasan en la suite local, y en una corrida manual con `BASE_URL=https://mira-pds.vercel.app` corren solo esos dos (D1, D6) | `Humo E2E` verde contra el commit recién desplegado |
| 3 | No es check obligatorio, pero un fallo avisa en `#mira-ci` y sube su reporte como artefacto | El script de `notify` se ejecuta con entradas simuladas y arma los mensajes de D4 | `#mira-ci` muestra "🚀 … el humo pasó"; `reporte-humo` está en el run |

## Lo que ya existe

- **`e2e/entorno.ts` (MIR-61, D3):** si `BASE_URL` viene definida,
  `SERVIDOR_EXTERNO` es `true`: Playwright no arranca `webServer`, el
  `globalSetup` no hace `migrate reset` y el fixture `proyectoPropio` lanza un
  error. Contra la demo, la base no se toca.
- **`auth.setup.ts`:** inicia sesión por API con ada, alan y grace y guarda las
  cookies en `e2e/.auth/`. El login no escribe en la base: el repositorio de
  auth solo hace `create` en el registro.
- **Lo que no protege `SERVIDOR_EXTERNO`:** algunas specs escriben sin
  `proyectoPropio`. Por ejemplo, `autenticacion.spec.ts` registra
  `e2e-xxxx@mira.dev`. Hoy, `BASE_URL=<demo> npm run test:e2e` dejaría basura
  permanente en la demo.
- **No hay tags:** el único filtro es `@movil` / `@solo-movil` por título, en
  los proyectos `chromium` y `mobile`.
- **Job `Desplegar` (MIR-71):** termina cuando `/api/health`, a través del
  rewrite de Vercel, responde 200 con `commit == GITHUB_SHA`. Que Vercel haya
  terminado su build **no** se verifica: un humo que corre después podría
  probar el frontend anterior.
- **`notify`:** `needs: [calidad, build, e2e, deploy]`. Si el despliegue sale
  bien, el mensaje es "🚀 Despliegue terminado: la API responde. Confirma la
  versión en el panel de Render." La recuperación compara con la conclusión del
  run anterior comparable.
- **Demo:** `ada@mira.dev` / `demo1234` son públicas. El seed asegura en cada
  deploy los usuarios y el proyecto `MIR`, pero un visitante puede borrar
  ítems, renombrar el proyecto o cambiar las columnas.
- **Arranque en frío:** Render duerme tras 15 min sin tráfico. UptimeRobot
  consulta cada 5 min, y `Desplegar` acaba de recibir un 200 con el commit
  nuevo: cuando arranca el humo, la API está despierta.
- **`apps/web/vite.config.ts`:** no tiene plugins propios. `index.html` no trae
  ningún meta de versión.

## Decisiones (grill del 2026-11-20)

### D1 — Guarda en la config: contra un host remoto solo corre `@humo`

`entorno.ts` exporta `AMBIENTE_REMOTO`: `BASE_URL` definida y con un hostname
distinto de `localhost`, `127.0.0.1` y `[::1]`. Con `AMBIENTE_REMOTO`,
`playwright.config.ts`:

- pone `grep: /@humo/` en el proyecto `chromium`,
- no incluye el proyecto `mobile`,
- aplica los valores de D5.

La guarda vive en la config y no en el comando: aunque alguien corra la suite a
mano contra la demo, solo corre lo marcado como de solo lectura. Es la misma
idea que la defensa `*_e2e` del `globalSetup`. `BASE_URL` contra servidores
locales propios sigue corriendo todo, como hoy. El job también pasa
`--grep @humo`, por claridad.

### D2 — Dos tests `@humo` con afirmaciones mínimas

`e2e/specs/humo.spec.ts`, con
`test.describe('MIR-72 · Humo de la demo', { tag: '@humo' }, …)` e imports
desde `../fixtures`:

1. **Login por la UI** (`storageState: sinSesion`): `/login`, correo y
   contraseña de `usuarios.ada`, "Ingresar". Afirma `/proyectos` y "Ada
   Lovelace" en el `banner`.
2. **Abrir el tablero de `MIR`** (sesión de ada del `setup`): `/proyectos`, el
   proyecto con clave `MIR` (por la clave, no por el nombre, que se puede
   editar) y "Ver tablero". Afirma la URL `/proyectos/<id>/tablero` y que la
   región "Columnas del tablero" sea visible.

No cuentan ítems ni columnas, porque un visitante puede cambiarlos y el humo no
debe quedar rojo por eso. Se navega desde la lista porque el id de `MIR` en
Supabase no es el local. Ninguno escribe: no hay `proyectoPropio`, registro ni
formularios de edición. Los dos tests también corren en el job `E2E` normal
contra el seed local, y `mobile` no los toma porque no llevan `@movil`.

### D3 — El humo espera al frontend del commit (`<meta name="mira-commit">`)

**Alcance extra, no está en los criterios.** Cierra el último "verde no
significa" del despliegue: sin esto, el humo podría probar el frontend
anterior.

- **`apps/web/vite.config.ts`:** un plugin con `transformIndexHtml` inyecta
  `<meta name="mira-commit" content="${process.env.VERCEL_GIT_COMMIT_SHA ?? ''}">`.
  Vercel define esa variable en el build hecho desde el deploy hook. Fuera de
  Vercel (local, CI, E2E) queda vacía.
- **Primer paso del job `humo`, "Esperar el frontend del commit":** consulta
  `https://mira-pds.vercel.app/?v=$GITHUB_SHA` cada 15 s, con 20 s por
  intento y un tope de 10 min, y extrae el `content` del meta. Usa el mismo
  esquema del bucle del health (MIR-71): sin espera inicial, sin imprimir el
  cuerpo. Da verde solo con `content == GITHUB_SHA`. Si se agota el tope, falla
  con un error que distingue tres casos: no respondió 200, el meta está vacío
  ("¿VERCEL_GIT_COMMIT_SHA expuesta en Vercel?") o el meta trae otro commit
  ("Vercel no publicó `<sha>`: revisa su panel").
- **Vercel no necesita configuración:** el panel ya no muestra la opción
  *Automatically expose System Environment Variables*, y la variable igual
  llega al build. Verificado el 2026-11-20 en el preview del PR #72: el
  `index.html` trae `<meta name="mira-commit" content="4508d4d…">`, el commit
  de la punta de la rama. Si algún día sale vacío, el job lo dice con su
  propio error.

### D4 — Rojo honesto y avisos en `notify`

- **Job `humo`** (`name: Humo E2E`): `needs: deploy`, con el mismo `if` que
  `Desplegar` (push a `main`). Sin `continue-on-error`: un fallo pone rojo el
  run de `main`. No puede ser check obligatorio, porque nunca corre en un PR, y
  la protección de ramas no cambia.
- **`notify`:** `needs` suma `humo`, y una variable de entorno nueva
  `HUMO: ${{ needs.humo.result }}`. Dentro del caso "calidad, build y e2e en
  verde":

  | `DEPLOY` | `HUMO` | Mensaje |
  | --- | --- | --- |
  | `success` | `success` | 🚀 **Despliegue terminado:** la demo responde y el humo pasó. |
  | `success` | `failure` | 🔴 **Humo E2E falló contra la demo** + "Traces y videos en el artefacto `evidencia-fallos-humo` de la ejecución." |
  | `success` | `cancelled` | ⚠️ **Humo E2E cancelado** |
  | `failure` / `cancelled` | `skipped` | Igual que hoy |
  | `skipped` (PR, `develop`) | `skipped` | Igual que hoy |

  Se quita "Confirma la versión en el panel de Render": la API y el frontend
  quedan verificados por commit. La recuperación sigue igual: un run rojo por
  el humo hace que el siguiente verde avise 🟢, y la recuperación solo se
  evalúa con `DEPLOY` en `success`/`skipped` y `HUMO` distinto de `failure`.
- **Artefactos,** 90 días como en `E2E`:
  - `reporte-humo` (`e2e/playwright-report/`), siempre;
  - `evidencia-fallos-humo` (`e2e/test-results/`), con `if: failure()` e
    `if-no-files-found: ignore`.

  Sin JUnit: nadie lo consume para el humo.

### D5 — Timeouts, reintentos y topes

- **`retries: 0`,** como el resto. Un humo intermitente es un Bug de MIR-74.
- **Solo con `AMBIENTE_REMOTO`:** `expect.timeout` 15 s, `navigationTimeout`
  30 s y `workers: 1`. El timeout por test sigue en 30 s. La suite local no
  cambia.
- **Sin precalentamiento:** la API está despierta (ver "Lo que ya existe").
- **Topes:** "Esperar el frontend del commit" con su tope de 10 min en el
  script; el paso de Playwright con `timeout-minutes: 5`; el job con
  `timeout-minutes: 20` como respaldo. El tope va en el paso para que el job
  quede `failure` y no `cancelled` (MIR-62).
- **El job instala lo mínimo:** `npm ci` y
  `playwright install --with-deps --only-shell chromium`. Sin Postgres, sin
  `db:generate` y sin build: no levanta servidores.

### D6 — Verificación en el PR

Con evidencia en la descripción del PR:

1. `npm run test:e2e` local sin `BASE_URL`: toda la suite verde, incluidos los
   dos `@humo`.
2. `BASE_URL=https://mira-pds.vercel.app npm run test:e2e` contra la demo
   actual, sin `--grep`: la guarda de D1 deja correr solo `setup` y los dos
   `@humo`, y pasan. Es de solo lectura.
3. El `run:` de "Esperar el frontend del commit" se ejecuta tal cual contra un
   `vite preview` local compilado con `VERCEL_GIT_COMMIT_SHA=<sha>`, en tres
   casos: meta igual (verde al primer intento), meta distinto (espera y rojo
   con tope corto) y meta vacío (rojo con su mensaje).
4. El script de `notify` se ejecuta con `DEPLOY`/`HUMO` simulados y sin
   webhook, para ver el mensaje que arma en cada fila de D4.
5. `actionlint` sobre `ci.yml`, si está disponible. En el CI del PR, los tres
   checks en verde, y `Desplegar` y `Humo E2E` _Skipped_.

### D7 — Verificación real en el release MIR-76

En el run del merge a `main`:

- `Humo E2E` verde.
- El log de la espera muestra el intento en que el meta coincidió con el
  commit del run.
- `#mira-ci` dice "🚀 … el humo pasó".
- `reporte-humo` está en el run.

Si sale rojo, se registra como Bug en MIR-74 con el artefacto de evidencia. El
enlace al run se anota en este plan.

### D8 — Documentación

- **`docs/ci-cd.md`:**
  - fila nueva en "Qué corre y cuándo";
  - sección "Humo E2E" (pasos, artefactos, topes, por qué no es obligatorio);
  - tabla de "Cuándo avisa `#mira-ci`" con las filas de D4, y "los otros cinco
    jobs";
  - en "Qué verifica el job", que el humo cubre el frontend.
- **`e2e/README.md`:** la fila de `BASE_URL` explica la guarda de D1 y los
  valores remotos de D5. Nota sobre la etiqueta `@humo`: solo para tests de
  solo lectura sobre datos del seed que siempre existen.
- **Comentarios en `ci.yml`, `vite.config.ts` y `playwright.config.ts`** que
  remiten a este plan.

## Pasos

1. Crear `ci/MIR-72-humo-e2e` desde `origin/develop`, sin upstream hacia
   `develop`.
2. `entorno.ts`: `AMBIENTE_REMOTO` (D1). `playwright.config.ts`: `grep`,
   proyectos y valores remotos (D1, D5).
3. `e2e/specs/humo.spec.ts` (D2).
4. `apps/web/vite.config.ts`: plugin del meta `mira-commit` (D3).
5. `ci.yml`: job `humo` (D3, D4, D5) y los cambios de `notify` (D4).
6. Pruebas locales de D6, con el resultado anotado en el PR.
7. Documentación (D8).
8. `npm run format:check`, `npm run lint`, `npm run typecheck`.
9. Commits convencionales en español con la clave MIR-72 (máximo 100
   caracteres por línea), y PR a `develop`.
10. Revisión cruzada (IsaiasACF) y fusión en `develop`.
11. ~~Confirmar en Vercel que `VERCEL_GIT_COMMIT_SHA` llega al build (D3).~~
    Hecho en el preview del PR #72.
12. ~~**Benjamín, en el release MIR-76:** la evidencia de D7, con el enlace al
    run.~~ Hecho en el [run 45537008110](https://github.com/MiraPdS/mira/actions/runs/45537008110) de `main`: `Humo E2E` en verde; la espera
    vio el meta `mira-commit` igual a `6bd4016` en el intento 1 y el humo dio
    `5 passed (8.9s)` (3 de `setup` y 2 `@humo`). `reporte-humo` está en el
    run y `Avisar en Discord` terminó en success. No hubo Bug para MIR-74.

## Fuera de alcance

- Hacer `Humo E2E` obligatorio o tocar la protección de ramas: nunca corre en
  un PR.
- Tests de humo que escriban datos, o un ambiente de staging aparte.
- Verificar el build de Vercel con su API o con un token: basta con el meta
  (D3).
- Node 24 en las actions: MIR-73.
