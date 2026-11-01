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
| [`ci.yml`](../.github/workflows/ci.yml) | push y PR a `main` y `develop` | `Lint, tipos y pruebas`: formato, lint, tipos, migraciones y las tres suites con cobertura contra un Postgres 16 efímero (puerto 5443); sube el artefacto `cobertura`. `Build`: compila web y API, solo si el anterior pasó. `Desplegar`: solo en push a `main` con los dos anteriores en verde ([ver Despliegue](#despliegue)) | Los dos primeros son checks obligatorios de `main`; `Desplegar` no lo es, porque corre después de fusionar |
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
| `NOTIFY_WEBHOOK_URL` | repositorio | Discord → canal `#mira-ci` → Integraciones → Webhooks → nuevo webhook | `MIR-53` |

- **Los deploy hooks son secretos reales:** quien tenga la URL dispara un
  despliegue. Nunca van en el código, en un PR, en un issue ni en una captura.
  Si uno se filtra, se regenera en Render o Vercel y se actualiza el secreto.
- **`NOTIFY_WEBHOOK_URL` es de repositorio**, no de `deploy`, porque `MIR-53`
  avisa fallos de PR y de `develop`, no solo de `main`. Si se filtra, lo peor
  es spam en el canal. Los PR desde forks no reciben secretos.
- **El nombre es neutro a propósito.** Discord acepta mensajes con formato de
  Slack agregando `/slack` al final de la URL del webhook: cambiar de
  herramienta es cambiar el valor, no el nombre.
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
| Qué envía | Toda la actividad del repo (todos los eventos): pushes, PR, comentarios | El resultado del pipeline: build roto, build que se recupera, despliegue terminado (`MIR-53`) |
| Canal | El canal de actividad que ya existía | `#mira-ci`, con un webhook propio |

Son webhooks distintos en canales distintos para que un build rojo no se
pierda entre el resto de la actividad, y para poder revocar uno sin romper el
otro.

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
| `Disparar despliegue de la API en Render` | Llama a `RENDER_DEPLOY_HOOK_URL` con `ref=<commit>`: pide desplegar el commit que pasó el CI | El hook no responde 2xx. Vercel ya no se dispara: el frontend no se adelanta a la API |
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
falla sigue contestando. Un despliegue fallido en Render o en Vercel se ve **en
su panel**, no en este job. La respuesta 2xx de un hook solo significa que el
pedido fue aceptado.

Cerrar ese hueco requiere exponer `RENDER_GIT_COMMIT` en `/api/health` y esperar
a que coincida con el commit del job, y no está hecho.

### Consecuencias

- **El `buildFilter` de `render.yaml` ya no filtra:** solo actúa sobre
  auto-deploys, así que cada release redespliega la API, aunque solo cambie el
  frontend.
- **`concurrency` cancela el run anterior** de la misma rama: si llegan dos
  pushes a `main` seguidos, despliega el más reciente.
- **No re-ejecutes un run viejo de `main`.** Render recibiría ese commit y
  Vercel la punta de `main`, y quedarían desalineados. Para volver atrás, usa
  el rollback de cada panel.

---

## Corte al despliegue desde Actions

Hasta el primer release con este job, Render y Vercel despliegan solos cada push
a `main`. Si el auto-deploy se apaga antes de que el job llegue a `main`, `main`
deja de desplegar. Si se apaga después, el primer release despliega dos veces.

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

   Si no aparece el Preview, **no sigas**: el hook no sirve con esta clave. Saca
   la clave de `apps/web/vercel.json` y replantea `MIR-54` (despliegue con la
   CLI de Vercel y un token).
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

**Si el primer release sale mal:**

- Si el job queda rojo por un hook, dispara el despliegue a mano (Render:
  Manual Deploy; Vercel: Redeploy) y corrige el secreto.
- Si el job queda verde pero Vercel no creó el despliegue, usa Redeploy en su
  panel y abre un hotfix que saque `git.deploymentEnabled`: `main` vuelve a
  desplegar por Git.
