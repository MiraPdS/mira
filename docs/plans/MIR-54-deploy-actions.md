# Plan — MIR-54 · Despliegue desde GitHub Actions

**Rama:** `feature/MIR-54-deploy-actions` (desde `origin/develop`)
**PR:** contra `develop`
**Estimacion:** 3 pts · **Prioridad:** Medium
**Alcance:** job `deploy` en `ci.yml`, `apps/web/vercel.json`, `render.yaml` y
documentacion. El agente no cambia ajustes de Render, Vercel ni GitHub, no carga
secretos y no crea hooks: los pasos manuales quedan escritos en
[`docs/ci-cd.md`](../ci-cd.md#corte-al-despliegue-desde-actions).

Fuente: `docs/backlog.md` §MIR-54 de `docs/MIR-33-alinear-entrega2-actions`
(PR #49, aun abierto).

## Criterios y como se verifican

| # | Criterio | Verificacion en el PR | Verificacion posterior al PR |
| --- | --- | --- | --- |
| 1 | Job con `environment: deploy` en push a `main`, tras los dos checks; dispara los dos hooks y verifica `/api/health` con reintentos | Lectura de `ci.yml`; GitHub acepta el workflow; los `run:` se ejecutan tal cual contra un servidor local (hook 2xx, hook 404, health 200, 503 seguido de 200, 503 hasta el tope, conexion rechazada) | Confirmado en [CI 41563910260](https://github.com/MiraPdS/mira/actions/runs/41563910260): hooks aceptados, Render Live, Vercel Production Ready y health 200 |
| 2 | Ejecucion roja, PR y push a `develop` no despliegan | `needs: [calidad, build]` e `if:` en `ci.yml`; en el CI del PR el job aparece _Skipped_ | Push a `develop` al fusionar este PR: job _Skipped_ |
| 3 | Auto-deploy apagado, un solo despliegue por release | En el PR solo llego la configuracion versionada (`vercel.json`, `render.yaml`); el corte manual se verifico al cerrar MIR-57 | Cumplido: [CI 41563910260](https://github.com/MiraPdS/mira/actions/runs/41563910260), commit `9d2e518`; un deploy por Deploy Hook en Render Live y uno en Vercel Production Ready, sin duplicados |
| 4 | `docs/ci-cd.md` describe el job y deja de listarlo como pendiente | Lectura del documento | — |

## Decisiones

**Resultado posterior al plan:** el [PR #57](https://github.com/MiraPdS/mira/pull/57)
se fusiono y el primer despliegue real termino correctamente. Los cuatro jobs
del CI de `main` pasaron; health respondio 200 y Discord acepto el aviso.
El [tag `v2.0-entrega2`](https://github.com/MiraPdS/mira/tree/v2.0-entrega2)
apunta al merge commit `9d2e518abf9f753415401bee6a1866f045ccc402` y el
[Release](https://github.com/MiraPdS/mira/releases/tag/v2.0-entrega2) esta publicado.
Las comprobaciones de los paneles acreditaron las versiones; la limitacion de
health descrita a continuacion permanece.

**Un 200 no prueba la version nueva: es una limitacion.** `/api/health` devuelve
`status`, `db` y `timestamp`, y las cabeceras (`Rndr-Id`, `X-Vercel-Id`) tampoco
identifican el commit (comprobado contra produccion). El deploy de Render es
sin corte: si el build falla, la version anterior sigue contestando 200. Sin
cambiar la API o agregar una `RENDER_API_KEY` no se puede distinguir, asi que:

- El job no dice que la version nueva salio. El paso se llama
  `Comprobar que la API responde` y lo deja escrito en el log.
- Lo que si garantiza: el hook de Render lleva `ref=$GITHUB_SHA`, asi que se
  pide desplegar exactamente el commit que paso el CI.
- Lo que se ve solo en el panel de Render: si ese deploy termino bien.
- Para cerrarlo haria falta exponer `RENDER_GIT_COMMIT` en `/api/health` y
  esperar a que coincida con `GITHUB_SHA`. Es un cambio de la API y queda fuera
  de este item.

**Reintentos.** Espera inicial de 3 min, porque sin ella el primer intento le
pega siempre a la version anterior y no comprueba nada; con ella tampoco se
garantiza que el despliegue haya terminado. Luego un intento cada 15 s con 20 s
de tope cada uno, durante 15 min. Al agotarse, el job falla en rojo. El tope cubre un arranque en frio (30-60 s, puede dar 504 en el rewrite).
Se consulta el dominio publico de Vercel: es el camino que usa la demo
(rewrite, API y base).

**Vercel: `git.deploymentEnabled: { "main": false }` en `apps/web/vercel.json`.**

- Preview: las ramas no listadas siguen en `true`, asi que los Preview de PR y
  de `develop` no cambian. El Preview de este mismo PR ya corre con la clave.
- Se descarta **Ignored Build Step**: la comunidad de Vercel reporta que tambien
  cancela los builds de un deploy hook, y no hay forma de distinguirlos.
- Se descarta `github.enabled: false`: la documentacion de deploy hooks dice
  que con esa clave los hooks no se disparan.
- **La documentacion no confirma que el hook sobreviva a `deploymentEnabled`.**
  Solo dice que la clave afecta a "commits", sin mencionar hooks, y no se
  encontro confirmacion de Vercel. Si lo bloqueara, el hook igual responderia
  2xx, sin desplegar, y el job quedaria verde con el frontend viejo. Por eso el
  corte exige una prueba previa en una rama desechable (paso 1 del corte).
  Si falla, se saca la clave y este item se replantea con la CLI y un token.

**Render: Auto-Deploy en Off a mano y `autoDeployTrigger: 'off'` en
`render.yaml`.** Con `commit` en el archivo, la proxima sincronizacion del
Blueprint volveria a encenderlo. Va entre comillas porque YAML 1.1 lee `off`
como booleano. El `buildFilter` solo actua sobre auto-deploys: desde ahora cada
release redespliega la API aunque solo cambie el frontend.

**Orden del corte.** `vercel.json` viaja en el mismo commit que el job: en
Vercel el corte es atomico. Render se apaga a mano justo antes de fusionar el
release; `main` solo cambia con un release, asi que esa ventana no pierde
despliegues. El orden exacto esta en
[`docs/ci-cd.md`](../ci-cd.md#corte-al-despliegue-desde-actions).

**Sin permisos nuevos.** El job no hace checkout y hereda `contents: read`.

**Secretos.** Viajan por `env:` del paso, no se interpolan en el script; no hay
`set -x` y no se imprime la respuesta de los hooks.

**`concurrency` (revision del PR).** `cancel-in-progress` no aplica a `main`:
cancelar un run no detiene el deploy que ya disparo, y se mezclarian versiones.
Sin cancelacion, un run puede llegar a los hooks con `main` adelantada, y el
hook de Vercel publicaria ese commit sin CI. Por eso el job parte confirmando
que su commit sigue siendo la punta, y si no, queda rojo sin disparar hooks.
Consulta con `github.token` y `contents: read`, sin permisos nuevos.

## Enganche de MIR-53

El aviso sera un job con `needs: deploy` e `if: always()` que lea
`needs.deploy.result`. No necesita cambios en este job.

## Fuera de alcance

- Cambiar `/api/health`, el paso `Pruebas con cobertura` o los jobs existentes.
- Aviso a Discord (MIR-53).
- `docs/backlog.md`: lo reescribe el PR #49.
