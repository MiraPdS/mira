# Plan — MIR-62 · Job E2E en GitHub Actions como check obligatorio

**Rama:** `ci/MIR-62-job-e2e-actions` (desde `develop`, con MIR-61 ya fusionado)
**PR:** uno solo, base `develop`
**Estimación:** 3 pts · **Prioridad:** Highest · **Responsable:** Benjamín
**Alcance:** job `E2E` en `ci.yml`, `needs` de `Desplegar` y del aviso, aviso de
Discord y `docs/ci-cd.md`. El agente no toca la protección de ramas ni los
secretos de GitHub: esos pasos los hace Benjamín desde la UI (pasos 9–11).

Fuente: [`docs/backlog.md` §MIR-62](../backlog.md),
[`plan-trabajo-entrega3.md` §3](../plan-trabajo-entrega3.md) y
[`MIR-61-andamiaje-playwright.md`](./MIR-61-andamiaje-playwright.md) (D1, D3 y D9).

## Criterios de aceptación (backlog)

| # | Criterio | Cómo se verifica |
| --- | --- | --- |
| 1 | `ci.yml` tiene el job `E2E` (`needs: build`), que levanta Postgres, migra, siembra, arranca la API compilada y `vite preview`, e instala solo chromium | Lectura de `ci.yml`; el CI del PR muestra `E2E` verde y su log muestra el `migrate reset`, los dos `webServer` y la suite |
| 2 | Si falla cualquier E2E, el job queda rojo, y `Desplegar` también espera a `E2E` | `retries: 0` + `needs: [calidad, build, e2e]` en `deploy`; el rojo controlado (paso 12) |
| 3 | Sube los artefactos con `if: always()`: el reporte HTML, el JUnit y, si algo falló, traces, screenshots y videos | Artefactos `reporte-e2e` y `reporte-junit-e2e` en el run verde del PR; `evidencia-fallos-e2e` en el rojo controlado |
| 4 | El aviso de `#mira-ci` indica si falló E2E, con el enlace a la ejecución | Captura del aviso 🔴 y del 🟢 en el rojo controlado |
| 5 | `E2E` pasa a ser check obligatorio de `main` el mismo día en que se fusiona, y `ci-cd.md` queda actualizado | `gh api …/branches/main/protection` lista los tres checks (paso 11) |
| 6 | Evidencia de un rojo controlado: PR con un E2E roto a propósito, capturas del job, del trace y del aviso, que después se revierte | PR draft cerrado sin fusionar, con las capturas en `docs/wiki/images/` (paso 12) |

## Lo que ya existe y se reutiliza

- **Andamiaje (MIR-61, PR #61):** con `CI=true`, `playwright.config.ts` arranca
  `node dist/server.js` (API en :3100) y `vite preview` (:4173) **sin
  compilar**. Les pasa a la API `DATABASE_URL`, `PORT`, `CORS_ORIGIN` y
  `JWT_SECRET`, y a la web `E2E_API_PORT`. También fija `workers: 2`,
  `forbidOnly` y `retries: 0`.
- **`entorno.ts`:** `E2E_DATABASE_URL` vale por defecto
  `postgresql://mira:mira@localhost:5443/mira_e2e?schema=public`.
- **`global-setup.ts`:** `prisma migrate reset --force` (migra y siembra) solo
  sobre bases `*_e2e`. A GitHub Actions no le afecta el bloqueo de Prisma para
  agentes de IA.
- **`apps/web/src/lib/api-client.ts:25`:** un build de producción sin
  `VITE_API_URL` usa `/api` relativo, que el proxy de `vite preview` lleva a
  la API de E2E (D2).
- **`ci.yml`:** el job `calidad` ya usa `postgres:16-alpine` en `5443:5432`
  con health check, y sube `cobertura` y `reporte-junit` con `if: always()` y
  90 días. `Build` compila con `VITE_API_URL=http://localhost:3000/api` y no
  sube nada. El aviso decide entre `calidad`, `build` y `deploy`.
- **`@playwright/test` 1.65.1** con versión exacta. `chromium` y `mobile` usan
  los dos `browserName: 'chromium'` en headless.
- **`calidad` ya cubre el lint y los tipos de las specs** (el `typecheck` de la
  raíz incluye `@mira/e2e`). `E2E` no los repite.

## Decisiones (grill del 2026-11-19)

### D1 — `E2E` compila por su cuenta

El job corre `npm run build` antes de Playwright, con
`DATABASE_URL` placeholder (como `Build`) y **sin** `VITE_API_URL`. No se toca
`Build`: es un check obligatorio y su artefacto no se usa para desplegar
(Render y Vercel compilan por su cuenta), así que subir `dist/` no daría más
garantía y sí más YAML. Costo: unos 30–40 s.

### D2 — Postgres del `services:` en 5443 con `mira_e2e`

Igual que `calidad`, pero con `POSTGRES_DB: mira_e2e` y el health check
`pg_isready -U mira -d mira_e2e`. El valor por defecto de `entorno.ts` ya
coincide, pero `E2E_DATABASE_URL` se declara igual en el `env:` del job para
que el YAML se lea solo. `BCRYPT_ROUNDS: '4'` también va en el `env:` del job,
como en `calidad`: el `webServer` hereda `process.env`. `CI=true` lo define
Actions.

### D3 — Chromium headless shell, sin caché

`npx -w @mira/e2e playwright install --with-deps --only-shell chromium` en cada
ejecución. Playwright desaconseja cachear navegadores en CI: restaurar tarda
casi lo mismo que descargar, y las dependencias de apt no se cachean. Si el job
resulta lento, la caché (`~/.cache/ms-playwright`, clave con la versión) se
agrega sin cambiar lo demás.

### D4 — Dependencias y nombre del check

```yaml
e2e:
  name: E2E            # nombre exacto del check obligatorio de main
  needs: build
  timeout-minutes: 20  # respaldo; el paso "Pruebas E2E" tiene 10
deploy:
  needs: [calidad, build, e2e]
notify:
  needs: [calidad, build, e2e, deploy]
```

- `needs: build` como pide el backlog, y no `needs: calidad` en paralelo: así
  no se gasta un runner con Postgres y navegador si el código no compila.
- Topes: 10 min en el paso `Pruebas E2E` y 20 en el job. La suite tarda
  ~19 s en local (1 min el job completo en el PR #64) y con las ocho specs
  debería quedar en 2–4 min. El tope va **en el paso** (revisión del PR #64):
  un paso que se pasa de tiempo queda `failure` y el aviso dice "falló E2E",
  mientras que un job que supera su propio `timeout-minutes` puede quedar
  `cancelled`, y de un cancelado el aviso no dice nada.
- **`E2E` no se renombra nunca** (ver la advertencia de `ci-cd.md`).

### D5 — Artefactos (los nombres de D9 de MIR-61)

| Artefacto | Ruta | Condición | Extra |
| --- | --- | --- | --- |
| `reporte-e2e` | `e2e/playwright-report/` | `if: always()` | `if-no-files-found: warn` (por defecto) |
| `reporte-junit-e2e` | `e2e/reportes/junit-e2e.xml` | `if: always()` | ídem |
| `evidencia-fallos-e2e` | `e2e/test-results/` | `if: failure()` | `if-no-files-found: ignore` |

Los tres con `retention-days: 90`. Con `retain-on-failure`, `test-results/`
solo tiene algo cuando un test falla. Si lo que falla es el build o el arranque,
no hay traces y no se agrega otra advertencia. Los dos reportes, en cambio, sí
advierten si faltan. Congelar la evidencia E2E en la Wiki
(`scripts/wiki-evidencias.mjs`, hoy solo lee `cobertura`) queda para MIR-75.

### D6 — Aviso de Discord

Un escalón más en la cadena, después de `build`:

```bash
elif [ "$E2E" = "failure" ]; then
  aviso="🔴 **Pipeline en rojo:** falló \`E2E\`"$'\n'"Traces y videos en el artefacto \`evidencia-fallos-e2e\` de la ejecución."
elif [ "$CALIDAD" = "success" ] && [ "$BUILD" = "success" ] && [ "$E2E" = "success" ]; then
```

- `E2E: ${{ needs.e2e.result }}` entra por `env`, como los otros.
- La recuperación 🟢 y los avisos de despliegue exigen ahora también `E2E`
  verde.
- Sin conteo de tests fallidos: obligaría a exponer `outputs:` desde el JUnit y
  no cambia lo que hace quien lee el aviso, que igual abre la ejecución. Queda
  como mejora.
- El mensaje de "Nada que avisar" también imprime `e2e=$E2E`.

### D7 — Check obligatorio el día del merge a `develop`

MIR-62 llega a `main` recién con el release (MIR-76), pero el PR de release
`develop → main` corre el `ci.yml` del merge, que ya trae `E2E`. Se activa el
mismo día del merge a `develop`, para que el check tenga efecto toda la entrega.

- **Riesgo:** un PR `hotfix/*` → `main` antes del release corre el `ci.yml` de
  `main`, sin `E2E`, y quedaría esperando el check. Si hace falta un hotfix, se
  quita `E2E` de la regla mientras dure y se vuelve a poner. Queda como nota en
  `ci-cd.md`.
- GitHub solo ofrece en la UI checks que corrieron en los últimos 7 días: se
  espera el run del push a `develop`.

### D8 — Rojo controlado

- Después de fusionar MIR-62, rama desechable `test/MIR-62-rojo-controlado`
  desde `develop`, con **un solo cambio**: la aserción de
  `specs/ejemplo.spec.ts` espera un texto que no existe (por ejemplo
  `Iniciar sesión (roto a propósito)`). Falla un `expect` real, con trace,
  screenshot y video. No sirve un error de sintaxis: reventaría en
  `Lint, tipos y pruebas` y no llegaría a `E2E`.
- **PR draft a `develop`**: `test: MIR-62 rojo controlado — NO FUSIONAR`.
- Capturas en `docs/wiki/images/` con prefijo `e3-mir62-`:
  1. el check `E2E` rojo en el PR (y `Desplegar`/`E2E` en el grafo del run);
  2. el trace (`npx -w @mira/e2e playwright show-trace <trace.zip>` del
     artefacto `evidencia-fallos-e2e`) en el paso que falló;
  3. el aviso 🔴 en `#mira-ci`;
  4. un segundo push que restaura la aserción: `E2E` verde y aviso 🟢 "El
     pipeline volvió a pasar".
- "Revertir" = **cerrar sin fusionar** y borrar la rama. Nada roto pasa por
  `develop`, que no está protegida.
- El enlace al PR y a los dos runs se anota en este plan y en
  `docs/wiki/Entrega-3.md`. MIR-75 los lleva a la página de evidencias.

## Resultado

- **Job (criterios 1–4):** [PR #64](https://github.com/MiraPdS/mira/pull/64),
  fusionado en `develop` el 2026-11-19 (merge `4afbd97`). `E2E` pasó en sus
  dos commits: 6 tests con 2 workers y ~1 min el job completo. La revisión
  pidió que el tope de tiempo fuera por paso (D4).
- **Rojo controlado (criterio 6):** [PR #66](https://github.com/MiraPdS/mira/pull/66),
  cerrado sin fusionar y con la rama borrada.
  - Rojo: [run 44657161160](https://github.com/MiraPdS/mira/actions/runs/44657161160),
    commit `27affb3`. Falló 1 de 6 tests (`toBeVisible() … element(s) not
    found`), `Desplegar` quedó _Skipped_, se subió `evidencia-fallos-e2e` y
    llegó el aviso 🔴 "falló `E2E`".
  - Verde tras restaurar: [run 44658912087](https://github.com/MiraPdS/mira/actions/runs/44658912087),
    commit `fccdea0`, con el aviso 🟢 "El pipeline volvió a pasar".
- **Criterio 5:** pendiente de agregar `E2E` a la regla de `main` (paso 10).

Capturas en `docs/wiki/images/`. Las incorpora a la página de evidencias
quien haga MIR-75:

| Archivo | Qué muestra |
| --- | --- |
| `e3-mir62-1-pr-check-e2e-rojo.png` | Checks del PR #66 con `E2E` en rojo y `Desplegar` en _Skipped_ |
| `e3-mir62-2-run-grafo.png` | Grafo del run rojo: Lint → Build → E2E ❌ → Desplegar ⊘ → Avisar |
| `e3-mir62-3-run-artefactos.png` | Artefactos del run rojo, con `evidencia-fallos-e2e` |
| `e3-mir62-4-trace-paso-fallido.jpg` | Trace en el `expect` que falló: la página muestra "Backlog" |
| `e3-mir62-5-trace-error.jpg` | Pestaña Errors del trace |
| `e3-mir62-6-discord-rojo.png` | Aviso 🔴 en `#mira-ci` |
| `e3-mir62-7-run-verde.png` | Run verde después de restaurar la aserción |
| `e3-mir62-8-discord-verde.png` | Aviso 🟢 en `#mira-ci` |

Para mostrar el trace en Chrome, el artefacto se sirvió con
`playwright show-trace --host 127.0.0.1 --port 9323 trace.zip`.

## Pasos

1. `git switch develop && git pull` y crear `ci/MIR-62-job-e2e-actions`.
2. `ci.yml`, job `e2e` (D1–D5): `services.postgres` (D2), `env:` del job,
   checkout, setup-node con caché de npm, `npm ci`,
   `npm run db:generate -w @mira/api`, `npm run build` (D1), instalar chromium
   (D3), `npm run test:e2e`, y los tres uploads (D5).
3. `ci.yml`: `needs` de `deploy` y `notify` (D4), variable `E2E` y escalón del
   aviso (D6), y el comentario de cabecera, que lista los checks obligatorios.
4. `docs/ci-cd.md`:
   - tabla "Qué corre y cuándo" con `E2E` y sus artefactos;
   - "Checks obligatorios de `main`" con los tres checks y la nota del hotfix
     (D7);
   - "Notificaciones" con el caso 🔴 `E2E`;
   - "Despliegue" con los tres jobs previos;
   - "Verificación" con el comando de `required_status_checks`.
5. `e2e/README.md`: una sección corta "En CI" con el job, los artefactos y cómo
   abrir el trace descargado.
6. Verificar en local lo que se pueda: `npm run format:check` y
   `npm run lint`. Simular el job: `npm run build` sin `VITE_API_URL` y
   después `CI=true npm run test:e2e`. Pide `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`
   si lo corre un agente.
7. Abrir el PR a `develop` con la clave `MIR-62`. En el CI del PR: `E2E` verde,
   los artefactos `reporte-e2e` y `reporte-junit-e2e`, y `Desplegar` _Skipped_.
8. Revisión cruzada y fusión en `develop`.
9. **Benjamín (mismo día):** esperar el run del push a `develop` con `E2E`
   verde.
10. **Benjamín:** Settings → Branches → regla de `main` → _Require status
    checks_ → agregar `E2E` (fuente GitHub Actions).
11. **Benjamín:** verificar con
    `gh api repos/MiraPdS/mira/branches/main/protection --jq '.required_status_checks.contexts'`,
    que debe listar `Lint, tipos y pruebas`, `Build` y `E2E`.
12. Rojo controlado (D8) y capturas.
13. Anotar en `docs/wiki/Entrega-3.md` §Problemas los tropiezos que aparezcan.

## Fuera de alcance

- Caché de navegadores (D3) y conteo de tests en el aviso (D6): mejoras.
- Evidencia E2E congelada en la Wiki: MIR-75.
- Humo contra la demo: MIR-72.
- Node 24: MIR-73.
