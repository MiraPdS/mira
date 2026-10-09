# Plan — MIR-7 · Ver y editar un proyecto

**Rama:** `feature/MIR-7-ver-editar-proyecto` (desde `origin/develop` **despues**
de fusionar el PR de MIR-5 web, MiraPdS/mira#18)
**Estimacion:** 3 pts, la de Jira (el alcance extra no cambia la estimacion; ver revision de #19)
· **Prioridad:** High
**Alcance:** full-stack en una sola rama y un solo PR, tres commits:
`feat(shared): MIR-7 esquema de edicion y accion PROJECT_UPDATED`,
`feat(api): MIR-7 ver y editar proyecto` y
`feat(web): MIR-7 pantalla configuracion del proyecto`.

## Criterios de aceptacion

Originales:

1. OWNER edita nombre o descripcion -> 200 y los cambios persisten.
2. MEMBER o VIEWER intenta editar -> 403, y la UI **no** muestra "Editar".
3. Campo desconocido en el PATCH -> 422.

Ampliados en esta sesion (se agregan a `docs/backlog.md`):

4. Cualquier miembro ve el proyecto (`GET /api/projects/:projectId`) con su
   rol; quien no es miembro recibe 403.
5. La clave es inmutable: un PATCH con `key` -> 422.
6. Cada campo que realmente cambia queda registrado en la bitacora
   (`PROJECT_UPDATED`, con valor anterior y nuevo).

## Lo que ya existe y se reutiliza

- `project:update` solo para OWNER (`packages/shared/src/permissions.ts`,
  blindado por `permissions.test.ts`).
- `validateBody` + `ValidationError` (422 con `{ campo: [mensajes] }`).
- `updateProjectSchema` en `@mira/shared` (se **redefine**, ver decision 1).
- Patron de autorizacion de MIR-9: `findMember` + `can()` -> `ForbiddenError`.
- Patron de transaccion con bitacora de `addMemberWithActivity` (incluye la
  rama sin `$transaction` para cuando `db` ya es un cliente transaccional).
- Receta de formulario de `CreateProjectPage` (react-hook-form + zodResolver,
  errores del servidor bajo su campo, banner para el resto).
- `projectKeys.all = ['projects']` como prefijo de invalidacion.

## Decisiones

1. **Clave inmutable.** `updateProjectSchema` =
   `createProjectSchema.pick({ name: true, description: true }).partial().strict()`
   + refine (decision 3). `key` cae en el `.strict()` -> 422 como cualquier
   campo desconocido. En la UI la clave se muestra solo lectura. Cambiar la
   clave queda fuera (afecta `reference` de todos los items).
2. **Descripcion vacia = `null`.** En el update, `description` acepta
   `string | null`; un string que tras `trim` queda vacio se normaliza a
   `null`. Misma normalizacion en `createProjectSchema` para que ambos
   caminos terminen igual en la base. Con esto se elimina el parche de
   `CreateProjectPage` que omitia la descripcion vacia.
3. **PATCH `{}` -> 422** via
   `.refine((o) => Object.keys(o).length > 0, { message: 'Debes enviar al menos un campo' })`.
   Un PATCH con los mismos valores actuales **si** escribe (200, `updatedAt`
   avanza) pero no genera filas de bitacora.
4. **Bitacora `PROJECT_UPDATED`.**
   - Nuevo valor en el enum Prisma `ActivityAction` y en `ACTIVITY_ACTIONS`
     (`packages/shared/src/domain.ts`). Deben quedar sincronizados.
   - Migracion `<timestamp>_mir7_project_updated_activity` (solo
     `ALTER TYPE ... ADD VALUE`).
   - Una fila por campo cambiado: `field` = `'name' | 'description'`,
     `fromValue` / `toValue` (null cuando la descripcion estaba o queda vacia),
     `workItemId` null, `actorId` = quien edita.
   - El diff se calcula en el service comparando contra el proyecto actual;
     update + filas de bitacora en **una** transaccion en el repositorio.
5. **Autorizacion (patron MIR-9).** Primero la membresia del actor:
   - PATCH: `!can(membership?.role, 'project:update')` -> 403 `OWNER_REQUIRED`.
   - GET: sin membresia -> 403 `PROJECT_ACCESS_DENIED`.
   No miembro e id inexistente dan el mismo 403 (no se filtra que ids
   existen y no hace falta otra consulta). 404 solo si el proyecto desaparece
   entre el chequeo y el update (Prisma P2025), caso practicamente imposible
   por el cascade de membresias.
6. **Contratos.**
   - `GET /api/projects/:projectId` -> `200 { project: ProjectDto }`.
   - `PATCH /api/projects/:projectId` -> `200 { project: ProjectDto }`.
   - Tipo compartido `ProjectResponse = { project: ProjectDto }` en
     `@mira/shared` (lo usan controlador, `project.api.ts` y MSW; tambien
     sirve para el 201 de crear).
7. **Ruta web `/proyectos/:projectId/configuracion`** (`ProjectSettingsPage`).
   `/proyectos/:projectId` sigue reservado para el panel de MIR-23 (Diego).
   - Vista: nombre, clave (monoespaciada, solo lectura), descripcion, insignia
     de rol. Enlaces "Volver a proyectos" y "Ver equipo"
     (`/proyectos/:id/miembros`).
   - Boton "Editar" solo si `can(project.myRole, 'project:update')`; cambia a
     formulario en linea.
8. **Comportamiento del formulario.**
   1. Envia solo `dirtyFields`.
   2. "Guardar" deshabilitado si `!isDirty || isPending` (nunca manda `{}`).
   3. "Cancelar" -> `reset()` y vuelve a la vista.
   4. Exito -> vista + `reset` con los valores nuevos + `role="status"`
      "Cambios guardados".
   5. 403 -> banner "Ya no tienes permisos para editar este proyecto" +
      `invalidateQueries(projectKeys.detail(id))`; el refetch trae el nuevo
      `myRole` y el boton desaparece.
   6. Concurrencia: gana la ultima escritura, sin bloqueo optimista.
9. **Cache.** `projectKeys.detail(id) = ['projects', id]` (cuelga de `all`).
   `useProject(id)` para el GET; `useUpdateProject(id)` hace `setQueryData`
   del detalle con la respuesta e invalida `projectKeys.all` (la lista de
   MIR-6 refleja el nombre nuevo).
10. **Punto de entrada.** Enlace "Configuracion" en cada tarjeta de la lista
    de MIR-6, visible para todo miembro (todos pueden ver la pagina).
11. **Sin E2E**, igual que MIR-6. Textos sin tildes, como el resto de la UI.

## Fuera de alcance

- Cambiar la clave del proyecto.
- Bloqueo optimista / deteccion de conflictos.
- Mostrar la bitacora en la UI (eso es MIR-23).

## Cambios por archivo

### Commit 1 — Shared

#### 1. `packages/shared/src/schemas/project.ts`

- Helper `optionalDescription` (trim, max 2000, `""` -> `null`) usado por
  create y update.
- `updateProjectSchema` segun decisiones 1, 2 y 3; `UpdateProjectInput`.
- `projectResponseSchema` / `ProjectResponse`.

#### 2. `packages/shared/src/domain.ts`

- `'PROJECT_UPDATED'` en `ACTIVITY_ACTIONS`.

### Commit 2 — API

#### 3. `apps/api/prisma/schema.prisma` + migracion

- `PROJECT_UPDATED` en `enum ActivityAction`.
- `npx prisma migrate dev --name mir7_project_updated_activity`.

#### 4. `apps/api/src/modules/projects/projects.repository.ts`

- `findById(projectId): Promise<Project | null>`.
- `updateWithActivity(projectId, data, changes, actorId): Promise<Project>`:
  `project.update` + `activityLog.createMany` (si `changes` no esta vacio) en
  una transaccion, con la misma rama sin `$transaction` que
  `addMemberWithActivity`.

#### 5. `apps/api/src/modules/projects/projects.service.ts`

- `getById(projectId, actorId): Promise<ProjectDto>` (decision 5, GET).
- `update(projectId, actorId, input): Promise<ProjectDto>`: autoriza, lee el
  proyecto, calcula el diff por campo, llama a `updateWithActivity`, devuelve
  `toProjectDto(project, 'OWNER')`.

#### 6. `apps/api/src/modules/projects/projects.controller.ts`

- `get` y `update`, mismo patron que `listMembers` (chequeo de `req.user` y
  de `projectId`), responden `satisfies ProjectResponse`.

#### 7. `apps/api/src/modules/projects/projects.router.ts`

- `router.get('/:projectId', controller.get);`
- `router.patch('/:projectId', validateBody(updateProjectSchema), controller.update);`

### Commit 3 — Web

#### 8. `apps/web/src/features/projects/project.api.ts`

- `get(projectId)` y `update(projectId, input)` devolviendo `ProjectDto`.

#### 9. `apps/web/src/features/projects/useProjects.ts`

- `projectKeys.detail`, `useProject`, `useUpdateProject` (decision 9).

#### 10. `apps/web/src/features/projects/ProjectSettingsPage.tsx` (nuevo)

- Decisiones 7 y 8. Estados: cargando (`role="status"`), error (alerta +
  "Reintentar"), 403 en el GET -> "No tienes acceso a este proyecto".

#### 11. `apps/web/src/features/projects/CreateProjectPage.tsx`

- Quitar la omision manual de la descripcion vacia (la resuelve el esquema).

#### 12. `apps/web/src/features/projects/ProjectsPage.tsx`

- Enlace "Configuracion" -> `/proyectos/:id/configuracion` en cada tarjeta.

#### 13. `apps/web/src/App.tsx`

- `/proyectos/:projectId/configuracion` -> `<ProjectSettingsPage />` dentro
  del layout autenticado.

#### 14. `apps/web/src/test/msw/handlers.ts`

- Handlers por defecto de `GET` y `PATCH /projects/:projectId`.

### Documentacion

- `docs/backlog.md`: MIR-7 con criterios 4–6 como documentacion complementaria; estimacion 3.
- `docs/plan-trabajo.md` y `docs/jira-import.csv`: sin cambios (coinciden con Jira).

## Tests

### Shared — `project.test.ts`

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | `{ key: 'X' }` | falla |
| 2 | campo desconocido | falla |
| 3 | `{}` | falla con "Debes enviar al menos un campo" |
| 4 | `description: ''` y `'   '` | -> `null` |
| 5 | `description: null` | aceptado |
| 6 | create con `description: ''` | -> `null` |

### API · unitario — `projects.service.test.ts`

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | OWNER cambia nombre | `updateWithActivity` con una fila `name` |
| 2 | MEMBER / VIEWER / no miembro / id inexistente | 403, sin llamar al update |
| 3 | Cambia solo la descripcion | una sola fila `description` |
| 4 | Mismos valores | escribe, cero filas |
| 5 | `getById` sin membresia | 403 `PROJECT_ACCESS_DENIED` |

### API · integracion — `projects.integration.test.ts`

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA1 · OWNER PATCH | 200; un GET posterior muestra el cambio |
| 2 | CA2 · MEMBER y VIEWER | 403 |
| 3 | CA3 · campo desconocido / `key` | 422 |
| 4 | `{}` | 422 |
| 5 | GET miembro / no miembro | 200 con `myRole` / 403 |
| 6 | Bitacora | filas `PROJECT_UPDATED` con from/to correctos |
| 7 | Sin cookie | 401 |

### Web · componente — `ProjectSettingsPage.test.tsx` (nuevo)

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | OWNER | ve "Editar" |
| 2 | CA2 · MEMBER / VIEWER | **no** ve "Editar" |
| 3 | Edita solo descripcion | el PATCH lleva solo `description` |
| 4 | Sin cambios | "Guardar" deshabilitado |
| 5 | 422 con campo | error bajo el campo |
| 6 | 403 al guardar | banner; tras el refetch (MEMBER) no hay "Editar" |
| 7 | Cancelar | restaura los valores y vuelve a la vista |
| 8 | Exito | "Cambios guardados" y valores nuevos en la vista |

`App.test.tsx`: la ruta `/configuracion` renderiza la pagina.
`ProjectsPage.test.tsx`: cada tarjeta enlaza a `/configuracion`.

## Verificacion

1. `npx vitest run --project web` y las suites unitaria e integracion de la
   API (`npm run db:up` antes) en verde.
2. `npm run lint`, `npm run typecheck`, `npm run format:check` sin errores.
3. Manual: `npm run db:up`, `npm run dev`;
   - OWNER: lista -> "Configuracion" -> "Editar" -> cambiar nombre -> la lista
     muestra el nombre nuevo;
   - vaciar la descripcion -> queda `null` (la tarjeta no muestra descripcion);
   - usuario VIEWER del mismo proyecto: ve la pagina sin "Editar";
   - `curl -X PATCH` con `key` -> 422; como VIEWER -> 403;
   - revisar en la base las filas `PROJECT_UPDATED`.

## Cierre

- Tres commits (ver Alcance). Push con
  `git push -u origin feature/MIR-7-ver-editar-proyecto`; PR hacia `develop`.
- Este plan (`docs/plans/`) no se commitea salvo que se decida lo contrario.
- Avisar a Diego: la ruta `/configuracion` existe para enlazarla desde el
  panel de MIR-23, y `PROJECT_UPDATED` aparecera en la actividad reciente.
- Avisar al equipo de la migracion nueva (ramas abiertas con migraciones
  deben ordenarse despues de esta o rebasar).
