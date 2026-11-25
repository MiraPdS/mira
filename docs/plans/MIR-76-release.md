# MIR-76 · Release `v3.0-entrega3` — plan

Decisiones de la sesión de preguntas (2026-11-20). Modelo: el release de la
Entrega 1 ([MIR-28](MIR-28-release.md)) y `v2.0-entrega2`.

## Alcance

Entrega 3 completa en `develop` (`0b21372`): MIR-61 a MIR-75, incluidos MIR-71
(commit en el health), MIR-72 (humo E2E) y MIR-73 (actions con Node 24).
**MIR-77 (video) se incluye en el tag:** la cápsula se publica antes del
release mediante el [PR #80](https://github.com/MiraPdS/mira/pull/80).

## Criterios

| # | Criterio | Cómo se verifica |
| --- | --- | --- |
| 1 | PR de release `develop → main` con `Lint, tipos y pruebas`, `Build` y `E2E` en verde | Checks del PR |
| 2 | Tag `v3.0-entrega3` sobre el merge commit, desplegado y con el humo en verde | Run de `main`: `Desplegar` y `Humo E2E` en verde (D4) |
| 3 | GitHub Release con funcionalidades, defectos, pruebas (con E2E) y limitaciones | D5 |
| 4 | Evidencia congelada con `npm run wiki:evidencias -- entrega-3` | `Evidencias-Entrega-3.md` con Vitest, cobertura y E2E (D1) |

## Decisiones

### D1 — La evidencia congelada incluye el E2E

`scripts/wiki-evidencias.mjs` hoy solo baja el artefacto `cobertura`. Se
extiende para bajar también `reporte-junit-e2e` (JUnit de Playwright) y agregar
una sección "Pruebas E2E" con una tabla por proyecto de Playwright (`setup`,
`chromium`, `mobile`): archivos, pasan, fallan y omitidas, más la duración de
la corrida (los proyectos corren en paralelo, así que no se suma por fila).
Desde la Entrega 3 el JUnit E2E es obligatorio: si no se puede descargar,
el comando falla sin sobrescribir la evidencia existente. En las entregas
históricas 1 y 2 sigue siendo opcional, para poder regenerar sus páginas.

Se corrige además el texto de cobertura: para `numero >= 2` dice que el run
aplicó los umbrales bloqueantes de MIR-55, que siguen en `vitest.config.ts`
(hoy, para la Entrega 3, diría "sin umbral bloqueante").

Esto cierra el pendiente "Congelar la evidencia E2E" de `Entrega-3.md` §8.

### D2 — Orden: cápsula → evidencia → PR de release

1. Rama `docs/MIR-76-release` desde `origin/develop`, sin upstream hacia
   `develop`. Commit X: script (D1), Wiki y este plan.
2. Push y PR a `develop` → el CI del PR sobre X queda en verde.
3. `npm run wiki:evidencias -- entrega-3` sobre X → commit Y (solo docs).
   Enlazarla desde `Entrega-3.md` §6 y `Proyecto-Evidencias.md`.
4. Revisión cruzada de ambos PRs. Fusionar primero #80 a `develop` y después
   #78, con merge commit. La rama de #78 incorpora #80 y resuelve la Wiki
   conservando los enlaces al video y a la evidencia congelada, sin los dos
   pendientes ya resueltos. Así se publica la Wiki y el video entra en el tag.
5. PR de release `develop → main` con los tres checks en verde. Merge **con
   merge commit**.
6. Verificar el run de `main` (D4).
7. Tag anotado `v3.0-entrega3` sobre el merge commit y GitHub Release (D5).
8. PR de cierre a `develop` (D3).

La evidencia congelada describe X. La corrección posterior del generador de
evidencias, su regresión y los cambios de documentación no modifican la app
ni sus E2E. Antes del merge se exige CI verde sobre la cabeza actual del PR;
el Release distingue el run fuente de la evidencia del commit etiquetado.

Regresión local: `node --test scripts/test/wiki-evidencias.test.mjs`.
También corre en el check `Verificar Wiki` de cada PR.

### D3 — Los enlaces posteriores al release van en un PR de cierre

Lo que solo existe después del push a `main` (run de `Desplegar` y `Humo E2E`,
`/api/health`) va desde el primer momento en el GitHub Release, y además en un
PR chico a `develop` (`docs: MIR-76 ...`) que:

- en `Entrega-3.md` §6 cambia "se enlaza en el cierre del release" por el run,
  y en §8 quita el pendiente del release;
- anota el run en la verificación posterior de los planes MIR-71 (D7), MIR-72
  (D7) y MIR-73 (paso 8).

Llega a `main` en el próximo release. No se re-etiqueta ni se redespliega.

### D4 — Verificación del run de `main`

En el run del push del merge commit a `main`:

- **MIR-71 D7:** `Desplegar` verde con `La API corre <sha>`, y el log con los
  intentos previos sin coincidencia. `/api/health` abierto a mano con `commit`
  igual al merge commit.
- **MIR-72 D7:** `Humo E2E` verde, el log de la espera con el intento en que
  el meta `mira-commit` coincidió, `reporte-humo` en el run, y el aviso
  "🚀 … el humo pasó" en `#mira-ci`.
- **MIR-73 D3:** cero anotaciones en `Humo E2E` (y en el resto de los jobs),
  en particular sin `Node.js 20 is deprecated`, consultando
  `/check-runs/{id}/annotations`.

**Si algo sale rojo** no se etiqueta. Un humo rojo se registra como Bug en
MIR-74 con su artefacto; se corrige con `hotfix/` a `main` y se etiqueta ese
merge commit. Si `Desplegar` queda rojo solo por el tope de MIR-71 D3, se
confirma en el panel de Render y se corrige igual con un hotfix.

### D5 — GitHub Release con secciones, como la Entrega 1

Tag anotado, título `v3.0-entrega3 — Entrega 3`, latest, no pre-release. El
borrador se muestra antes de publicar.

- **Funcionalidades:** suite E2E con Playwright (13 flujos, 38 pruebas en el
  pipeline, proyecto móvil), job `E2E` obligatorio en `main`, humo contra la
  demo después de cada despliegue, commit en `/api/health` (MIR-71) y actions
  con Node 24 (MIR-73).
- **Defectos corregidos:** los E2E no destaparon defectos en la app (MIR-74
  sin Bugs). Se listan los problemas reales del pipeline y las specs que se
  corrigieron dentro de cada PR (timeout que no avisaba, humo contra el
  frontend anterior, chequeos negativos prematuros, etc.).
- **Pruebas ejecutadas:** totales de Vitest y cobertura, y la tabla E2E, de
  `Evidencias-Entrega-3.md`; checks del PR de release; run de `main` con
  `Humo E2E`.
- **Despliegue:** `Desplegar` y `/api/health` con el commit del tag.
- **Limitaciones conocidas:** plan free de Render (arranque en frío);
  credenciales de demo públicas; el arrastre de tarjetas no se prueba en E2E;
  el aviso de Discord no cuenta los tests fallidos; sin caché de navegadores
  en CI.
- **Enlaces** a la Wiki y a la [cápsula de video](https://youtu.be/eX3-Vx8km5Q),
  y **Uso de IA**.

### D6 — Jira

- MIR-76 a **In Progress** al abrir el PR a `develop` y a **Done** después de
  publicar el Release.
- MIR-74 y MIR-75 ya están en Done. La épica MIR-59 queda en Backlog, como las
  demás épicas del proyecto. MIR-77 no se toca.

Cada movimiento en Jira, la fusión a `main`, el tag y la publicación del
Release se confirman con Benjamín antes de hacerlos.

## Verificación

Completado en el PR de cierre (D3), 2026-11-25.

- **PR a `develop`:** [#78](https://github.com/MiraPdS/mira/pull/78), después de
  [#80](https://github.com/MiraPdS/mira/pull/80) (cápsula), como pide D2.
  Evidencia congelada del run 44683341339 sobre `4c612d4`.
- **PR de release:** [#81](https://github.com/MiraPdS/mira/pull/81), aprobado por
  IsaiasACF, con `Lint, tipos y pruebas`, `Build` y `E2E` en verde. Merge
  commit `6bd401677780c2b818fdc9cb9ec4abc67c406533`.
- **Run de `main`:** [run 45537008110](https://github.com/MiraPdS/mira/actions/runs/45537008110), los seis jobs en success. `Desplegar`:
  `La API corre 6bd401677780c2b818fdc9cb9ec4abc67c406533` en el intento 8. `Humo E2E`: meta coincidente en el
  intento 1 y `5 passed (8.9s)`. Sin anotaciones de deprecación (D4).
- **`/api/health`:** `{"status":"ok","db":"ok","commit":"6bd401677780c2b818fdc9cb9ec4abc67c406533"}`.
- **Tag y Release:** tag anotado `v3.0-entrega3` sobre `6bd4016` y
  [GitHub Release](https://github.com/MiraPdS/mira/releases/tag/v3.0-entrega3)
  publicado como latest.
- **Jira:** MIR-76 en Done; MIR-59 en Backlog (D6).

## Fuera de alcance

- Cerrar épicas en Jira o grabar el video (MIR-77).
- Secretos, Render, Vercel, protección de ramas y nombres de los checks.
- Contar tests fallidos en el aviso de Discord o cachear navegadores en CI.
