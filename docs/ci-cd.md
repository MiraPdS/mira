# CI/CD

Cómo se verifica, se protege y se despliega Mira con GitHub Actions, y cómo
recrear la configuración desde cero. La decisión de usar
Actions en lugar de Jenkins y Discord en lugar de Slack está en
[D14](./decisiones-tecnicas.md#d14--github-actions-como-cicd-oficial). El
ambiente de demostración en sí está en [despliegue.md](./despliegue.md).

Este documento nunca contiene valores de secretos: solo sus nombres y de dónde
se obtienen.

---

## Qué corre y cuándo

| Workflow | Disparadores | Jobs | Qué bloquea |
| --- | --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | push y PR a `main` y `develop` | `Lint, tipos y pruebas`: formato, lint, tipos, migraciones y las tres suites con cobertura contra un Postgres 16 efímero (puerto 5443); sube los artefactos `cobertura` y `reporte-junit` (resultado de cada prueba en formato JUnit), también si las pruebas fallan. `Build`: compila web y API, solo si el anterior pasó. `Desplegar`: solo en push a `main` con los dos anteriores en verde ([ver Despliegue](#despliegue)). `Avisar en Discord`: corre siempre, al final ([ver Notificaciones](#notificaciones)) | Los dos primeros son checks obligatorios de `main`; `Desplegar` no lo es, porque corre después de fusionar, y `Avisar en Discord` tampoco: no bloquea nada |
| [`wiki.yml`](../.github/workflows/wiki.yml) | PR a `develop` y `main`; push a `develop` que toque `docs/wiki/`; a mano (`workflow_dispatch`) | `Verificar Wiki`: reglas de forma, y en el PR de release a `main` que no queden pendientes. `Publicar Wiki` (o `Vista previa de la Wiki` en un PR): copia `docs/wiki/` a la Wiki de GitHub | No es obligatorio en `main`; un rojo se ve en el PR |

Ambos declaran `permissions: contents: read` a nivel de workflow. Un job que
necesite más lo pide en su propio bloque (`Publicar Wiki` pide
`contents: write` para empujar a la Wiki). No se depende del ajuste por defecto
del repositorio, aunque hoy también es solo lectura.

---

## Checks obligatorios de `main`

La protección de `main` exige:

- 1 aprobación, y una aprobación se descarta si llegan commits nuevos.
- Conversaciones resueltas.
- Los checks **`Lint, tipos y pruebas`** y **`Build`** en verde.
- Que las reglas apliquen también a los administradores (`enforce_admins`):
  nadie empuja directo a `main`, ni siquiera un hotfix (`hotfix/*` → `main`
  también va por PR).

> **No renombres los jobs de `ci.yml`.** La protección identifica cada check
> por el `name:` del job. Si cambia, `main` queda esperando un check que nunca
> llega y ningún PR se puede fusionar. Si de verdad hay que renombrarlo, se
> actualiza la regla de `main` en el mismo momento en que se fusiona el cambio.

---

## Secretos

| Secreto | Nivel | De dónde sale el valor | Lo usa |
| --- | --- | --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | environment `deploy` | Render → servicio `mira-api` → Settings → Deploy Hook | Job `Desplegar` |
| `VERCEL_DEPLOY_HOOK_URL` | environment `deploy` | Vercel → proyecto web → Settings → Git → Deploy Hooks (rama `main`) | Job `Desplegar` |
| `NOTIFY_WEBHOOK_URL` | repositorio | Discord → canal `#mira-ci` → Integraciones → Webhooks → nuevo webhook | Job `Avisar en Discord` |

- **Los deploy hooks son secretos reales:** quien tenga la URL dispara un
  despliegue. Nunca van en el código, en un PR, en un issue ni en una captura.
  Si uno se filtra, se regenera en Render o Vercel y se actualiza el secreto.
- **`NOTIFY_WEBHOOK_URL` es de repositorio**, no de `deploy`, porque el aviso
  cubre fallos de PR y de `develop`, no solo de `main`. Si se filtra, lo peor
  es spam en el canal. Los PR desde forks no reciben secretos.
- **El nombre es neutro a propósito:** cambiar de herramienta no obliga a
  renombrarlo. Hoy el job envía el campo `content`, propio de Discord, a la URL
  sin sufijo. Si se pasa a otra herramienta, también cambia ese payload.
- `GITHUB_TOKEN` lo crea GitHub en cada ejecución; no se configura.

---

## Environment `deploy`

| Regla | Valor | Por qué |
| --- | --- | --- |
| Ramas permitidas | solo `main` | GitFlow: `main` es lo liberado. No hay staging, así que si `develop` desplegara, la demo pública mostraría trabajo sin release. `develop` sigue corriendo el CI completo |
| Revisores obligatorios | ninguno | Una aprobación por deploy contradice "sin pasos manuales". El control está antes: a `main` solo se llega por PR revisado y con `enforce_admins` |
| Wait timer | ninguno | Mismo motivo |
| Secretos | `RENDER_DEPLOY_HOOK_URL`, `VERCEL_DEPLOY_HOOK_URL` | Solo un job que corre en `main` y declara `environment: deploy` los puede leer |

Se llama `deploy` y no `production` porque los nombres de environment no
distinguen mayúsculas y `Production` ya existe: lo creó la integración de
Vercel. Se mezclarían los historiales de despliegue.

Los otros environments del repositorio (`Production` y `Preview` de Vercel, y
el de Render) los crean y usan las integraciones. No se tocan.

---

## Notificaciones

Hay dos caminos a Discord, a propósito separados:

| | Webhook del repositorio | `NOTIFY_WEBHOOK_URL` |
| --- | --- | --- |
| Dónde se configura | Settings → Webhooks del repositorio | Secreto de Actions |
| Qué envía | Toda la actividad del repo (todos los eventos): pushes, PR, comentarios | El resultado del pipeline: build roto, build que se recupera, despliegue terminado |
| Canal | El canal de actividad que ya existía | `#mira-ci`, con un webhook propio |

Son webhooks distintos en canales distintos para que un build rojo no se
pierda entre el resto de la actividad, y para poder revocar uno sin romper el
otro.

### Cuándo avisa `#mira-ci`

El job `Avisar en Discord` de [`ci.yml`](../.github/workflows/ci.yml) corre al
final de cada ejecución, en PR, `develop` y `main`, con `needs` sobre los otros
tres jobs e `if: always()`. Cada mensaje trae la rama, el commit, el autor y un
enlace a la ejecución.

| Resultado de la ejecución | Mensaje |
| --- | --- |
| `Lint, tipos y pruebas` o `Build` en rojo | 🔴 Pipeline en rojo, con el job que falló |
| Verde, y la ejecución anterior comparable había fallado | 🟢 El pipeline volvió a pasar |
| `Desplegar` en verde | 🚀 Despliegue terminado (con 🟢 si además se recuperó) |
| `Desplegar` en rojo | 🔴 Despliegue fallido |
| `Desplegar` cancelado | ⚠️ Despliegue cancelado |
| Verde sin fallo previo | Nada: `#mira-ci` solo habla cuando algo cambió |
| Cancelada porque llegó un push más nuevo | Nada: no es un fallo |

- **"Anterior comparable"** es la última ejecución terminada y no cancelada de
  `ci.yml` con la misma rama, el mismo evento y este repositorio. Un PR se
  compara con sus propias ejecuciones, un push a `develop` no se mezcla con el
  PR de release que sale de `develop`, y un fork con una rama del mismo nombre
  no cuenta. Si se re-ejecuta un run, primero cuentan sus intentos anteriores no
  cancelados.
- **Si GitHub no entrega la ejecución anterior,** no se puede saber si hubo
  recuperación: la ejecución deja una advertencia. Un 🔴 o un 🚀 salen igual.
- **🚀 no prueba la versión nueva,** por lo mismo que un `Desplegar` verde: ver
  [Qué verifica el job](#qué-verifica-el-job).
- **Un fallo por ejecución.** Si una rama sigue en rojo, cada ejecución vuelve a
  avisar.
- **Sin aviso de un workflow inválido.** Si `ci.yml` no se puede interpretar,
  ningún job corre, tampoco este. Ese rojo solo se ve en GitHub.
- **Un aviso que falla no pone rojo el run.** Deja una advertencia en la
  ejecución. Si no, un webhook roto marcaría rojo un código sano, y la ejecución
  siguiente anunciaría una recuperación que no ocurrió.
- **Sin secreto no hay aviso.** Un PR desde un fork o de Dependabot no recibe
  `NOTIFY_WEBHOOK_URL`: el job termina en verde y deja una nota en la ejecución.
- **Permisos:** el job hereda `contents: read`. Lee las ejecuciones anteriores
  con `GITHUB_TOKEN`, y esa lectura funciona porque el repositorio es público.
  Si deja de serlo, hay que agregar `actions: read` al job.

---

## Cómo recrear la configuración

Lo hace una persona con permisos de administrador del repositorio, desde la
UI. Ningún valor se pega en el repositorio ni en un PR.

1. **Discord:** crear el canal `#mira-ci` y, en él, un webhook nuevo
   (Editar canal → Integraciones → Webhooks). Copiar su URL.
2. **Render:** servicio `mira-api` → Settings → Deploy Hook. Copiar la URL.
3. **Vercel:** proyecto web → Settings → Git → Deploy Hooks → crear uno para
   la rama `main`. Copiar la URL.
4. **GitHub → Settings → Environments → New environment** `deploy`:
   - Deployment branches and tags: _Selected branches and tags_ → `main`.
   - Sin required reviewers ni wait timer.
   - Environment secrets: `RENDER_DEPLOY_HOOK_URL` (paso 2) y
     `VERCEL_DEPLOY_HOOK_URL` (paso 3).
5. **GitHub → Settings → Secrets and variables → Actions → New repository
   secret** `NOTIFY_WEBHOOK_URL` (paso 1).
6. **GitHub → Settings → Branches →** regla de `main`: además de lo descrito
   en [Checks obligatorios](#checks-obligatorios-de-main), activar _Do not
   allow bypassing the above settings_ (`enforce_admins`).

No se crea un environment `production` ni se tocan `Production`, `Preview` o
el webhook del repositorio a Discord.

### Verificación

Estos comandos muestran solo nombres y reglas, nunca valores:

```bash
gh api repos/MiraPdS/mira/environments/deploy --jq '{name, deployment_branch_policy, protection_rules}'
gh api repos/MiraPdS/mira/environments/deploy/deployment-branch-policies --jq '.branch_policies[].name'
gh secret list --env deploy
gh secret list
gh api repos/MiraPdS/mira/branches/main/protection --jq '.enforce_admins.enabled'
```

Lo esperado: el environment `deploy` con política de ramas propia y sin
reglas de revisores; `main` como única rama; los dos deploy hooks en `deploy`;
`NOTIFY_WEBHOOK_URL` a nivel de repositorio; y `true`.

---

## Despliegue

El job `Desplegar` de [`ci.yml`](../.github/workflows/ci.yml) corre en cada push
a `main`, con `environment: deploy` y solo si `Lint, tipos y pruebas` y `Build`
pasaron. Una ejecución roja no despliega, y en un PR o en `develop` el job queda
_Skipped_.

| Paso | Qué hace | Falla en rojo si |
| --- | --- | --- |
| `Confirmar que el commit sigue siendo la punta de main` | Compara el commit del run con la punta de `main`. El hook de Vercel construye la punta: sin este paso publicaría un commit sin CI | `main` avanzó. No se dispara ningún hook: despliega el run del commit más nuevo |
| `Disparar despliegue de la API en Render` | Llama a `RENDER_DEPLOY_HOOK_URL` con `ref=<commit>`: pide desplegar el commit que pasó el CI | El hook no responde 2xx. En ese caso Vercel no se dispara |
| `Disparar despliegue del frontend en Vercel` | Llama a `VERCEL_DEPLOY_HOOK_URL`. El hook no acepta commit: construye la punta de `main` | El hook no responde 2xx |
| `Comprobar que la API responde` | Espera 3 min y consulta `https://mira-pds.vercel.app/api/health` cada 15 s, con 20 s de tope por intento | No hay un 200 en 15 min |

El log nunca muestra las URL: entran por `env`, no se imprime la respuesta de
los hooks y los pasos no usan `set -x`.

### Qué verifica el job

Lee esto antes de confiar en un job verde:

| Verde significa | Verde **no** significa |
| --- | --- |
| El CI pasó y los dos servicios aceptaron el despliegue | Que los despliegues hayan terminado bien |
| La demo, el rewrite y la base contestan 200 después de la espera | Que esté corriendo la versión nueva |

`/api/health` no informa el commit y el despliegue de Render es sin corte:
la versión anterior contesta 200 hasta que la nueva la reemplaza, y si el build
falla sigue contestando. La espera de 3 min da tiempo al despliegue, pero no
garantiza que haya terminado: el job acaba con el primer 200, y ese 200 puede
venir de la versión anterior. Un despliegue fallido en Render o en Vercel se ve **en
su panel**, no en este job. La respuesta 2xx de un hook solo significa que el
pedido fue aceptado.

Cerrar ese hueco requiere exponer `RENDER_GIT_COMMIT` en `/api/health` y esperar
a que coincida con el commit del job, y no está hecho.

### Consecuencias

- **El `buildFilter` de `render.yaml` ya no filtra:** solo actúa sobre
  auto-deploys, así que cada release redespliega la API, aunque solo cambie el
  frontend.
- **En `main` los runs van en serie y no se cancelan:** cancelar un run no
  detiene el despliegue que ya disparó. `concurrency` sigue cancelando en PR y
  en `develop`. Si llegan varios pushes a `main`, GitHub deja en espera solo el
  más reciente, y un run que arranca con `main` adelantada queda rojo sin
  disparar hooks.
- **Serie en GitHub no significa serie en Render.** El job termina con el
  primer 200, y el despliegue anterior puede seguir en curso cuando llega el
  hook siguiente. Lo resuelve la política de deploys superpuestos de Render.
- **Un run viejo de `main` no despliega,** aunque se re-ejecute: queda rojo en
  el paso de la punta. Para volver atrás, usa el rollback de cada panel.
- **Después de un Instant Rollback en Vercel, usa _Undo Rollback_.** Mientras
  no se deshaga, Vercel no asigna los dominios de producción a los despliegues
  nuevos: el release siguiente no se publica y el job igual queda verde.
- **El frontend puede adelantarse a la API.** Vercel se dispara apenas Render
  acepta el hook, sin esperar a que termine. Si el build de Render falla, el
  frontend nuevo queda contra la API anterior con el job verde.

---

## Corte al despliegue desde Actions

**Corte realizado en MIR-57:** el [PR #57](https://github.com/MiraPdS/mira/pull/57)
y el [CI 41563910260](https://github.com/MiraPdS/mira/actions/runs/41563910260)
registran el primer release con los cuatro jobs en success. Para el commit
`9d2e518` se verificó manualmente un deploy por Deploy Hook en Render (Live) y
uno en Vercel Production (Ready), sin doble despliegue, health 200 y aviso de
Discord aceptado. [Tag publicado](https://github.com/MiraPdS/mira/tree/v2.0-entrega2)
y [GitHub Release](https://github.com/MiraPdS/mira/releases/tag/v2.0-entrega2).
El procedimiento que sigue documenta ese corte inicial; no se debe repetir por
cada release. Las limitaciones de la comprobación de health siguen vigentes.

Antes del primer release con este job, Render y Vercel desplegaban solos cada
push a `main`. Apagar el auto-deploy antes de que el job llegara a `main`
dejaba de desplegar; apagarlo después producía dos despliegues en el primer release.

`apps/web/vercel.json` lleva `git.deploymentEnabled: { "main": false }`: viaja en
el mismo commit que el job, así que en Vercel el corte ocurre solo. En Render
hay que apagarlo a mano. `main` solo cambia con un release, por eso se apaga
justo antes de fusionarlo.

Lo hace una persona, **en este orden**:

1. **Probar que el hook de Vercel sobrevive a `deploymentEnabled`.** Se hace
   antes del release, una sola vez. La documentación de Vercel no lo confirma, y
   si la clave lo bloqueara el hook respondería 2xx sin desplegar.
   1. Crea una rama desechable `chore/prueba-hook-vercel` desde `develop`, con
      `"chore/prueba-hook-vercel": false` en `git.deploymentEnabled`, y empújala.
      Vercel **no** debe crear un despliegue por ese push.
   2. Vercel → proyecto web → Settings → Git → Deploy Hooks: crea un hook para
      esa rama y llámalo una vez con `POST`.
   3. Vercel → Deployments: debe aparecer un Preview de esa rama.
   4. Borra el hook y la rama.

   **No sigas** con el corte en ninguno de estos dos casos. Saca la clave de
   `apps/web/vercel.json` y replantea `MIR-54` (despliegue con la CLI de Vercel y
   un token):

   - Si el push de la rama sí creó un despliegue, Vercel ignora la clave: `main`
     publicaría el frontend por Git, sin esperar al CI y aunque quede rojo.
   - Si el hook no creó el Preview, el hook no sirve con esta clave.

   Esta prueba usa un Preview: no ejercita el hook de `main`, que se comprueba
   recién en el paso 7.
2. **Revisar `RENDER_DEPLOY_HOOK_URL` y `VERCEL_DEPLOY_HOOK_URL`** con
   `gh secret list --env deploy`, y que el hook de Vercel sea el de `main`.
3. **Revisar el Blueprint** en Render → Blueprints → `mira`. Debe leer `main`. Si
   sigue en `feature/MIR-27-despliegue-demo`, no lo sincronices: esa rama trae
   `autoDeployTrigger: commit` y volvería a encender el auto-deploy.
4. **Dejar listo el PR de release** `develop` → `main`: aprobado y con checks
   verdes, a un clic de fusionarse.
5. **Render:** servicio `mira-api` → Settings → Build & Deploy → Auto-Deploy →
   _Off_. Si el release se aborta, vuelve a _On Commit_.
6. **Fusionar el release.** Vercel no despliega por Git, Render tampoco, y el job
   `Desplegar` dispara los dos hooks.
7. **Verificar el primer release:**

   ```bash
   gh run list --workflow ci.yml --branch main --limit 1
   gh api "repos/MiraPdS/mira/deployments?environment=Production&per_page=3" --jq '.[]|[.sha[0:7],.created_at]|@tsv'
   ```

   - El job `Desplegar` está verde.
   - Render → Events: **un** deploy, con el commit del release.
   - Vercel → Deployments: **un** despliegue de Production, marcado como Deploy
     Hook, y en estado Ready.
   - Un PR abierto sigue recibiendo su Preview.
   - `#mira-ci` recibió 🚀 Despliegue terminado, con la rama `main`, el commit
     del release, el autor y el enlace a la ejecución.

**Si el primer release sale mal:**

- Si el job queda rojo por un hook, dispara el despliegue a mano (Render:
  Manual Deploy; Vercel: Redeploy) y corrige el secreto.
- Si el job queda verde pero Vercel no creó el despliegue, usa Redeploy en su
  panel y abre un hotfix que saque `git.deploymentEnabled`: `main` vuelve a
  desplegar por Git.
