# CI/CD

Cómo se verifica, se protege y (desde `MIR-54`) se despliega Mira con GitHub
Actions, y cómo recrear la configuración desde cero. La decisión de usar
Actions en lugar de Jenkins y Discord en lugar de Slack está en
[D14](./decisiones-tecnicas.md#d14--github-actions-como-cicd-oficial). El
ambiente de demostración en sí está en [despliegue.md](./despliegue.md).

Este documento nunca contiene valores de secretos: solo sus nombres y de dónde
se obtienen.

---

## Qué corre y cuándo

| Workflow | Disparadores | Jobs | Qué bloquea |
| --- | --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | push y PR a `main` y `develop` | `Lint, tipos y pruebas`: formato, lint, tipos, migraciones y las tres suites con cobertura contra un Postgres 16 efímero (puerto 5443); sube el artefacto `cobertura`. `Build`: compila web y API, solo si el anterior pasó | Los dos jobs son checks obligatorios de `main` |
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
| `RENDER_DEPLOY_HOOK_URL` | environment `deploy` | Render → servicio `mira-api` → Settings → Deploy Hook | `MIR-54` |
| `VERCEL_DEPLOY_HOOK_URL` | environment `deploy` | Vercel → proyecto web → Settings → Git → Deploy Hooks (rama `main`) | `MIR-54` |
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

## Pendiente en `MIR-54`

Hoy Render y Vercel despliegan solos cada push a `main` (ver
[despliegue.md](./despliegue.md)). Cuando `MIR-54` dispare los deploy hooks
desde Actions, tiene que **apagar ese auto-deploy** en los dos servicios (Render:
Auto-Deploy en _Off_; Vercel: ignorar los builds de `main` por Git), o cada
release se desplegaría dos veces, y sin esperar a que el CI esté verde.
