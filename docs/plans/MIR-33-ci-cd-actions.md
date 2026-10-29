# Plan — MIR-33 · CI/CD oficial en GitHub Actions

**Rama:** `feature/MIR-33-ci-cd-actions` (desde `docs/MIR-56-plan-entrega-2`,
PR #38 aun abierto)
**PR:** apilado, base `docs/MIR-56-plan-entrega-2`; GitHub lo reapunta a
`develop` cuando #38 se fusione y se borre su rama.
**Estimacion:** 3 pts (antes 5) · **Prioridad:** Highest
**Alcance:** configuracion de GitHub (environment, secretos, proteccion de
`main`) que hace **una persona** desde la UI, un cambio minimo en `ci.yml` y
documentacion. El agente no crea webhooks, no carga secretos ni cambia ajustes
de seguridad del repo: deja los pasos escritos y la persona los ejecuta.

Fuente original: [`docs/backlog.md` §MIR-33](../backlog.md) ("Jenkins en la
nube"). Se reescribe en este PR.

## Por que cambia el item

El profesor acepto GitHub Actions en lugar de Jenkins y Discord en lugar de
Slack (consulta en el Slack del curso):

> si se puede usar Github Actions, tambien se puede usar Discord... De
> preferencia Jenkins, la experiencia de aprendizaje es mas rica...

El equipo eligio Actions. Con eso MIR-33 tal como estaba escrito (VM, HTTPS,
agente con Node 20 y Docker, almacen de credenciales de Jenkins) deja de tener
sentido: los runners `ubuntu-latest` ya traen Node 20 y Docker, y el Postgres
efimero ya corre como `services:` en `ci.yml`. Lo que queda es la base de
secretos, permisos y documentacion de la que dependen MIR-53 y MIR-54.

## Criterios de aceptacion (reescritos)

1. Queda registrada **D14 — GitHub Actions como CI/CD oficial**, citando la
   autorizacion del profesor; D11 remite a D14 y la tabla de decisiones
   pendientes marca resueltas "Donde corre Jenkins" y Slack/Discord.
2. Existe el environment `deploy` en GitHub, restringido a la rama `main`, sin
   revisores obligatorios, con los secretos `RENDER_DEPLOY_HOOK_URL` y
   `VERCEL_DEPLOY_HOOK_URL`. `NOTIFY_WEBHOOK_URL` (Discord) existe como secreto
   de repositorio. Ningun valor esta en el repositorio.
3. Los workflows declaran `permissions:` minimos y la proteccion de `main`
   aplica tambien a los administradores.
4. `docs/ci-cd.md` documenta disparadores, jobs, secretos (nombre, donde vive,
   de donde sale el valor, quien lo usa) y como recrear la configuracion.

## Lo que ya existe y se reutiliza

- `.github/workflows/ci.yml`: push y PR a `main`/`develop`, jobs
  `Lint, tipos y pruebas` (con Postgres 16 efimero en 5443) y `Build`,
  artefacto `cobertura`. **No tiene bloque `permissions:`.**
- `.github/workflows/wiki.yml`: ya declara `permissions: contents: read` (es el
  patron a copiar).
- Permisos por defecto del token del repo: `read` (verificado con
  `gh api repos/MiraPdS/mira/actions/permissions/workflow`).
- Proteccion de `main`: 1 aprobacion, `dismiss_stale_reviews`, conversaciones
  resueltas, checks obligatorios `Lint, tipos y pruebas` y `Build`.
  **`enforce_admins` esta apagado** (ya hubo commits directos a `main`,
  ver `1c94e87`).
- Environments existentes, creados por las integraciones: `Production` y
  `Preview` (Vercel) y `feature/MIR-27-despliegue-demo - mira-api` (Render).
- Webhook del repositorio a Discord con `events: ["*"]` (Settings -> Webhooks):
  feed de actividad del repo. No es un secreto de Actions y **no se toca**.
- No hay ningun secreto de Actions cargado.
- Render y Vercel despliegan solos desde `main` (MIR-27, decision 4).

## Decisiones

1. **Actions como CI/CD oficial (D14).** Jenkins descartado con autorizacion
   del profesor. Jenkins local con ngrok tambien descartado. Se pierde la
   "experiencia mas rica" que menciona el profesor; se gana no mantener una VM
   (coherente con D12, que ya descarto una VM por costo y mantencion).
2. **Environment `deploy`**, no `production`: los nombres de environment no
   distinguen mayusculas y `Production` ya es el de Vercel; se mezclarian los
   historiales de despliegue.
3. **Solo `main` usa `deploy`.** GitFlow: `main` es lo liberado. No hay staging
   (fuera de alcance desde MIR-27), asi que `develop` desplegando mostraria
   trabajo sin release en la demo publica. `develop` sigue corriendo CI
   completo.
4. **Sin revisores obligatorios en el environment.** Una aprobacion manual por
   deploy contradice "sin pasos manuales"; el control esta en que a `main` solo
   se llega por PR revisado (decision 6).
5. **Secretos y donde viven.**

   | Secreto | Nivel | Valor | Lo usa |
   | --- | --- | --- | --- |
   | `RENDER_DEPLOY_HOOK_URL` | environment `deploy` | Render -> servicio `mira-api` -> Settings -> Deploy Hook | MIR-54 |
   | `VERCEL_DEPLOY_HOOK_URL` | environment `deploy` | Vercel -> proyecto web -> Settings -> Git -> Deploy Hooks (rama `main`) | MIR-54 |
   | `NOTIFY_WEBHOOK_URL` | repositorio | Discord -> canal `#mira-ci` -> Integraciones -> Webhooks -> nuevo webhook | MIR-53 |

   - `NOTIFY_WEBHOOK_URL` es de **repositorio** y no de `deploy` porque MIR-53
     tiene que avisar fallos de PR y de `develop`, no solo de `main`. Si se
     filtra, lo peor es spam en el canal; los PR desde forks no reciben
     secretos.
   - Es un **webhook nuevo en un canal aparte**, no la URL del webhook actual:
     el canal actual recibe todos los eventos del repo y un build rojo se
     perderia; ademas cada uno se revoca sin romper el otro.
   - Nombre neutro a proposito: Discord acepta payloads con formato Slack
     agregando `/slack` a la URL, asi que cambiar de herramienta es cambiar el
     valor, no el nombre.
   - Los deploy hooks permiten disparar un deploy a quien tenga la URL: son
     secretos reales. Nunca en el PR, en `docs/ci-cd.md` ni en capturas.
6. **`enforce_admins` activado en `main`.** Con `deploy` atado a `main`, un
   push directo de admin desplegaria sin PR ni revision. Hotfixes tambien van
   por PR (`hotfix/*` -> `main`).
7. **`permissions: contents: read` explicito en `ci.yml`**, a nivel workflow,
   igual que `wiki.yml`. No cambia el comportamiento hoy (el default ya es
   `read`) pero deja de depender de un ajuste del repo. MIR-54 subira lo que
   necesite a nivel de job.
8. **Nombres de los checks congelados.** Los jobs `Lint, tipos y pruebas` y
   `Build` son los checks obligatorios de `main`; renombrarlos deja la
   proteccion esperando un check que nunca llega. Se dice en `docs/ci-cd.md`.
9. **Verificacion por CLI y capturas, sin job nuevo.** Un job que compruebe
   secretos solo correria tras el release; la CLI lo muestra hoy y lista solo
   nombres.

## Pasos

### 1. Configuracion en GitHub, Discord, Render y Vercel (persona, manual)

1. Discord: crear el canal `#mira-ci` y un webhook nuevo en ese canal.
2. Render: copiar el Deploy Hook del servicio `mira-api`.
3. Vercel: crear un Deploy Hook para la rama `main` en el proyecto web.
4. GitHub -> Settings -> Environments -> New environment `deploy`:
   - Deployment branches and tags: *Selected branches* -> `main`.
   - Sin required reviewers ni wait timer.
   - Environment secrets: `RENDER_DEPLOY_HOOK_URL`, `VERCEL_DEPLOY_HOOK_URL`.
5. GitHub -> Settings -> Secrets and variables -> Actions -> Repository secret
   `NOTIFY_WEBHOOK_URL`.
6. GitHub -> Settings -> Branches -> regla de `main` -> activar *Do not allow
   bypassing the above settings* (`enforce_admins`).

No crear un environment `production` ni tocar `Production`/`Preview` ni el
webhook del repositorio a Discord.

### 2. `ci.yml`: permisos minimos

- Agregar a nivel raiz de `.github/workflows/ci.yml`, despues de
  `concurrency:`:

  ```yaml
  permissions:
    contents: read
  ```

  con un comentario corto en el estilo del archivo (por que explicito).
- No renombrar jobs ni cambiar pasos.

Commit: `ci: MIR-33 permisos minimos explicitos en el workflow de CI`

### 3. `docs/ci-cd.md` (nuevo)

Secciones:

1. **Que corre y cuando**: tabla de workflows (`ci.yml`, `wiki.yml`),
   disparadores, jobs y que bloquea cada uno.
2. **Checks obligatorios de `main`** y la advertencia de la decision 8.
3. **Secretos**: la tabla de la decision 5 (nombre, nivel, de donde sale,
   quien lo usa), sin ningun valor.
4. **Environment `deploy`**: reglas y por que solo `main`.
5. **Notificaciones**: el webhook del repositorio (feed de actividad, todos los
   eventos) vs `NOTIFY_WEBHOOK_URL` (resultado del pipeline, MIR-53).
6. **Como recrear la configuracion**: los pasos de §1, mas los comandos de
   verificacion de §8.
7. **Pendiente en MIR-54**: Render y Vercel despliegan solos desde `main`; MIR-54
   debe apagar ese auto-deploy o se desplegaria dos veces.

Enlazar desde `docs/despliegue.md` y el README si tienen una seccion de CI.

### 4. `docs/decisiones-tecnicas.md`

- **D14 — GitHub Actions como CI/CD oficial**, con el formato de las demas
  (Decision / Por que / Descartado / Consecuencia). Citar la respuesta del
  profesor. Descartado: Jenkins en VM (costo y mantencion, ver D12), Jenkins
  local con ngrok (depende de un PC encendido). Consecuencia: environment
  `deploy`, secretos de §5, Discord en vez de Slack, MIR-51..55 se reescriben.
- D11: agregar al final de su Consecuencia una linea que remita a D14.
- Tabla "Decisiones pendientes": "Donde corre Jenkins" -> resuelto (D14);
  agregar o resolver Slack/Discord -> Discord (D14).
- Si el archivo tiene indice, agregar D14.

### 5. `docs/backlog.md`

- Reescribir `### MIR-33` como **CI/CD oficial en GitHub Actions**, Tarea
  tecnica, Highest, **3 pts**, con los cuatro criterios de arriba.
- Al inicio de la Epica 9, una nota: Jenkins se reemplazo por Actions (D14);
  `MIR-51` a `MIR-55` se reescriben en un PR de documentacion aparte.

### 6. `docs/plan-trabajo-entrega2.md`

Solo lo que MIR-33 rompe directamente:

- Fila `MIR-33`: `3` pts, "CI/CD oficial en GitHub Actions".
- Benjamin `20 pts` -> `18 pts`; alcance `74` -> `72` story points; frente
  CI/CD de la epica 9 `20` -> `18` pts.
- Nodo del DAG: `J10["MIR-33 CI/CD en Actions · 3"]`.
- Ola 0: `MIR-33` Actions en vez de "Jenkins".
- Revisar que la suma de la ruta de Jenkins (seccion 3) no quede inconsistente;
  si cambia, solo el numero, el texto de la cadena va en el seguimiento.

### 7. Wiki

- `docs/wiki/Proyecto-Resumen-y-alcance.md`: fila `MIR-33` ->
  "CI/CD oficial con GitHub Actions, notificaciones a Discord".

### 8. Evidencia y PR

Comandos (muestran solo nombres, nunca valores):

```bash
gh api repos/MiraPdS/mira/environments/deploy --jq '{name, deployment_branch_policy, protection_rules}'
gh api repos/MiraPdS/mira/environments/deploy/deployment-branch-policies --jq '.branch_policies[].name'
gh secret list --env deploy
gh secret list
gh api repos/MiraPdS/mira/branches/main/protection --jq '.enforce_admins.enabled'
```

Capturas (sin valores visibles): Settings -> Environments -> `deploy`;
Settings -> Branches (regla de `main`); canal `#mira-ci` creado.

Commits sugeridos:

1. `ci: MIR-33 permisos minimos explicitos en el workflow de CI`
2. `docs: MIR-33 D14 GitHub Actions como CI/CD oficial`
3. `docs: MIR-33 guia de CI/CD, secretos y environment deploy`
4. `docs: MIR-33 reescribir el item y ajustar el plan de la Entrega 2`

PR con base `docs/MIR-56-plan-entrega-2`, cuerpo con la salida de los comandos
y las capturas.

Manual en Jira (persona): MIR-33 -> titulo "CI/CD oficial en GitHub Actions",
descripcion con los criterios nuevos, estimacion 3.

## Mapa de criterios

| Criterio | Pasos | Verificacion |
| --- | --- | --- |
| 1. D14 | 4 | Revision del diff: D14, nota en D11, tabla de pendientes |
| 2. Environment y secretos | 1, 3 | `gh api .../environments/deploy`, `.../deployment-branch-policies` -> `main`, `gh secret list --env deploy` (2 nombres), `gh secret list` (`NOTIFY_WEBHOOK_URL`), `git grep` sin URLs de hooks |
| 3. Permisos y `enforce_admins` | 1, 2 | `ci.yml` con `permissions: contents: read`; CI verde en el PR; `.enforce_admins.enabled` -> `true` |
| 4. `docs/ci-cd.md` | 3 | Revision: todas las secciones, ningun valor de secreto |

## Fuera de alcance (seguimiento, PR de documentacion aparte)

- Reescribir `MIR-51` a `MIR-55`: `MIR-51` se reduce (falta JUnit), `MIR-52`
  queda casi hecho (el check ya es obligatorio desde MIR-25), `MIR-53` pasa a
  Discord con `NOTIFY_WEBHOOK_URL`, `MIR-54` debe apagar el auto-deploy de
  Render y Vercel.
- Ruta critica, Definicion de Hecho ("build de Jenkins... Slack"), zona
  compartida `Jenkinsfile` en `plan-trabajo-entrega2.md`.
- Pagina `docs/wiki/Entrega-2.md` y arquitectura de la Wiki.
- Cualquier job que use los secretos (MIR-53, MIR-54).

## Definicion de terminado

- [ ] Los cuatro criterios verificados con la tabla de arriba.
- [ ] Ningun valor de secreto en el repo, el PR ni las capturas.
- [ ] `npm run format:check` y CI verde en el PR.
- [ ] Jira de MIR-33 actualizado.
