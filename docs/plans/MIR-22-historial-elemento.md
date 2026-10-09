# Plan — MIR-22 · Historial de cambios de un elemento

**Rama:** `feature/MIR-22-historial-elemento` (desde `origin/develop` actualizado;
MIR-26 ya esta fusionado)
**Estimacion:** 5 pts · **Prioridad:** Medium
**Alcance:** full-stack en una sola rama y un solo PR contra `develop`, cuatro commits:

1. `feat(shared): MIR-22 esquema de actividad y respuesta del historial`
2. `feat(api): MIR-22 historial de un elemento`
3. `refactor(web): MIR-22 extraer describeActivity`
4. `feat(web): MIR-22 seccion Historial en el detalle`

## Criterios de aceptacion

Originales (`docs/backlog.md`):

1. Item con cambios -> al abrir su historial veo las entradas en orden
   cronologico inverso, con actor y fecha.
2. Un cambio de estado se lee en lenguaje natural ("movio de Por hacer a En
   progreso"), no como nombres de columnas de base de datos.
3. Si una actualizacion falla a mitad de camino y se revierte la transaccion,
   **no** queda una entrada de historial huerfana.

Ampliados en esta sesion (se agregan a `docs/backlog.md`):

4. Cualquier miembro con `work-item:view` (incluido VIEWER) ve el historial;
   quien no es miembro recibe 404, igual que el detalle y los comentarios.
5. El historial muestra como maximo las 100 entradas mas recientes; si hay mas,
   la UI lo dice ("Mostrando los 100 cambios mas recientes").
6. En el panel del proyecto (MIR-23) la actividad sigue diciendo "un ítem"
   (sin referencia); agregar la referencia queda como seguimiento.

## Lo que ya existe y se reutiliza

- **La escritura del historial ya esta hecha.** `ActivityLog` existe y cada
  cambio de un item escribe su fila en la MISMA transaccion:
  `ITEM_CREATED`, `ITEM_UPDATED` (una fila por campo), `ITEM_STATUS_CHANGED`,
  `ITEM_DELETED` (`work-item.repository.ts`) y `COMMENT_ADDED`
  (`comment.repository.ts`). MIR-22 es **lectura y presentacion**.
- Indice `@@index([workItemId, createdAt])` en `activity_log`: la consulta del
  historial ya esta cubierta, no hay migracion.
- MIR-23 ya tiene el formateador en lenguaje natural (`actionLabels`,
  `fieldLabels`, `formatoValor`, `detalleActividad`) dentro de
  `apps/web/src/features/projects/ProjectSummaryPage.tsx`, y el backend ya
  traduce ids de usuario a nombres (`USER_ID_FIELDS`) dentro de
  `getProjectSummary`.
- `projectActivitySchema` en `packages/shared/src/schemas/project.ts` ya
  describe una entrada de actividad.
- Pruebas de rollback con trigger transaccional (MIR-16 `MIR16_DELETE_BLOCKED`,
  MIR-19 `MIR19_ACTIVITY_BLOCKED`) en `work-item.integration.test.ts`: el
  patron se reutiliza.
- `COMMENT_LIST_LIMIT = 100` en comentarios: mismo criterio de tope.

## Decisiones

1. **Formateador unico en la web.** Se extrae a
   `apps/web/src/features/activity/describeActivity.ts`, con pruebas propias, y
   lo usan el panel (MIR-23) y el historial. La API entrega datos
   estructurados (`action`, `field`, `fromValue`, `toValue`, actor); el
   cliente arma la frase. En el backend, la traduccion id -> nombre sale de
   `getProjectSummary` a un helper compartido (`resolveActivityUserNames`)
   que usan ambos endpoints. Motivo: dos copias divergen, y el primer campo
   nuevo terminaria mostrando `assigneeId` en una de las vistas.

2. **Contrato.** `GET /api/projects/:projectId/work-items/:workItemId/activity`,
   en el modulo `work-items` existente (router -> controller -> service ->
   repository). Respuesta `{ data: ActivityDto[], truncated: boolean }`.
   `projectActivitySchema` se renombra a `activitySchema`, conservando
   `ProjectActivityDto` como alias para no tocar MIR-23. Orden
   `createdAt desc, id desc` (varias filas `ITEM_UPDATED` de un mismo PATCH
   comparten timestamp). Autorizacion igual a `getById`: no miembro -> 404,
   miembro sin `work-item:view` -> 403, item de otro proyecto -> 404.

3. **Sin paginacion, tope de 100.** `ACTIVITY_LIST_LIMIT = 100`; el repositorio
   pide 101 filas y `truncated = filas.length > 100`. Ningun criterio pide
   paginar y un item rara vez supera 100 cambios; el tope acota la consulta.

4. **Redaccion.** `describeActivity(activity, context)` con `context: 'item' | 'project'`
   devuelve una frase sin el actor (la UI antepone el nombre). Contexto `item`:

   | Entrada | Frase |
   |---|---|
   | `ITEM_CREATED` | creó el ítem |
   | `ITEM_STATUS_CHANGED` | movió de **Por hacer** a **En progreso** |
   | `ITEM_UPDATED` status / type / priority | cambió la prioridad de **Media** a **Alta** |
   | `ITEM_UPDATED` title | cambió el título de «A» a «B» |
   | `ITEM_UPDATED` description | editó la descripción (sin valores) |
   | `ITEM_UPDATED` estimate | cambió la estimación de 3 a 5 pts · estimó en 5 pts · quitó la estimación |
   | `ITEM_UPDATED` dueDate | cambió la fecha límite al 12-10-2026 · quitó la fecha límite (es-CL, en UTC para que no se corra el dia) |
   | `assigneeId` (MIR-17 futuro) | asignó a **Diego** · quitó el responsable |
   | `COMMENT_ADDED` | agregó un comentario |
   | campo desconocido | actualizó el ítem (nunca el nombre del campo) |

   Contexto `project`: las mismas frases referidas a "un ítem" (p. ej.
   "movió un ítem de Por hacer a En progreso", "creó un ítem"), mas las
   acciones de proyecto y miembros que ya existen. El DTO del panel no cambia.

5. **UI.** Seccion "Historial" en `WorkItemDetail`, **debajo de Comentarios**,
   con la misma estructura que estos: carga, 403/404 "no disponible", error con
   "Reintentar", vacio ("Todavía no hay cambios registrados"). Siempre visible,
   sin pestañas ni colapsable. Cada entrada: actor en negrita + frase + `<time>`
   en es-CL. Si `truncated`, nota al final de la lista.

6. **Frescura.** Hook `useWorkItemActivity(projectId, workItemId)` con clave
   `activityQueryKey(projectId, workItemId)` (`['work-item-activity', ...]`,
   fuera de `workItemKeys` porque `useBoard` la invalida por predicado y no
   puede importar `useWorkItems` sin un ciclo), invalidada tras editar el
   item, mover la tarjeta y crear un comentario. Al eliminar se invalida sin
   refetch, igual que los comentarios, para no pedir un historial que da 404.

7. **Entrega.** Un PR, cuatro commits (ver arriba); el refactor del
   formateador va en su propio commit para que una regresion de MIR-23 sea
   atribuible.

## Fuera de alcance

- Paginacion del historial.
- Referencia del item en la actividad del panel (MIR-23): requiere un join o
  guardar la referencia en `ITEM_UPDATED`.
- Escribir `ITEM_ASSIGNED` / asignar responsable: es MIR-17. El formateador ya
  sabe redactar `assigneeId` para cuando llegue.
- Mostrar el contenido anterior/nuevo de la descripcion (diff de texto).

## Cambios por archivo

### Commit 1 — Shared

#### 1. `packages/shared/src/schemas/activity.ts` (nuevo) y `project.ts`

- Renombrar `projectActivitySchema` -> `activitySchema`; exportar
  `ActivityDto` y mantener `projectActivitySchema` / `ProjectActivityDto`
  como alias.
- `workItemActivityResponseSchema = z.object({ data: z.array(activitySchema), truncated: z.boolean() })`
  y su tipo `WorkItemActivityResponse`.
- Reexportar `schemas/activity.ts` desde el indice y eliminar
  `activityEntrySchema` (andamiaje de MIR-1 sin uso).

### Commit 2 — API

#### 2. `apps/api/src/modules/projects/projects.repository.ts`

- Extraer la traduccion id -> nombre (`USER_ID_FIELDS`, consulta unica a
  `user`) a un helper `resolveActivityUserNames(db, activities)` en
  `apps/api/src/lib/activity.ts`; `getProjectSummary` lo usa sin cambiar su
  resultado.

#### 3. `apps/api/src/modules/work-items/work-item.repository.ts`

- `export const ACTIVITY_LIST_LIMIT = 100`.
- `listActivity(projectId, workItemId, limit = ACTIVITY_LIST_LIMIT)`:
  `findMany` con `where { projectId, workItemId }`, orden
  `[{ createdAt: 'desc' }, { id: 'desc' }]`, `take: limit + 1`, `include`
  actor `{ id, name }`; aplica `resolveActivityUserNames`; devuelve
  `{ activities: primeras limit, truncated }`.
- Agregar el metodo a la interfaz `WorkItemRepository`.

#### 4. `apps/api/src/modules/work-items/work-item.service.ts`

- `activity(projectId, actorId, workItemId)`: rol null -> 404; sin
  `work-item:view` -> 403; item inexistente o de otro proyecto -> 404; mapea a
  `ActivityDto` (`createdAt` ISO).

#### 5. `work-item.controller.ts` + `work-item.router.ts`

- `controller.activity` responde 200 `{ data, truncated }`.
- `router.get('/:projectId/work-items/:workItemId/activity', requireAuth, controller.activity)`.

### Commit 3 — Web (refactor)

#### 6. `apps/web/src/features/activity/describeActivity.ts` (nuevo)

- Tablas de etiquetas y `describeActivity(activity, context)` segun la
  decision 4. Formato de fecha con `timeZone: 'UTC'`.

#### 7. `apps/web/src/features/projects/ProjectSummaryPage.tsx`

- Elimina `actionLabels`, `fieldLabels`, `formatoValor`, `detalleActividad` y
  usa `describeActivity(activity, 'project')`.
- Ajustar `ProjectSummaryPage.test.tsx` a la nueva redaccion.

### Commit 4 — Web (historial)

#### 8. `apps/web/src/features/work-items/work-items.api.ts`

- `getWorkItemActivity(projectId, workItemId)` validando con
  `workItemActivityResponseSchema`.

#### 9. `apps/web/src/features/work-items/useWorkItems.ts`

- `activityQueryKey(projectId, workItemId)` y `useWorkItemActivity`.
- Invalidar esa clave en: edicion del item, cambio de estado del tablero y
  creacion de comentario.

#### 10. `apps/web/src/features/work-items/WorkItemDetail.tsx`

- Renderiza `<WorkItemHistory>` (componente nuevo, `WorkItemHistory.tsx`)
  debajo de Comentarios (decision 5), con `aria-labelledby` propio.

#### 11. `apps/web/src/test/msw/handlers.ts`

- Handler por defecto para `GET .../activity`.

### Documentacion

- `docs/backlog.md`: criterios ampliados 4–6 bajo MIR-22.
- `docs/wiki/Proyecto-Requisitos-y-trazabilidad.md`: fila MIR-22 a ✅ con
  evidencia U / I / C una vez fusionado.

## Tests

### API — integracion (`work-item.activity.integration.test.ts`, archivo propio para no chocar con otras ramas)

- **Criterio 3 (rollback de una edicion):** dentro de `prisma.$transaction`,
  crear un trigger `BEFORE INSERT ON activity_log` que lanza
  `MIR22_ACTIVITY_BLOCKED` cuando `NEW.field = 'priority'`; PATCH por el
  service con `{ title, priority }`. Esperar el rechazo, titulo y prioridad
  intactos y `ITEM_UPDATED` = 0 para el item (la fila de `title` no
  sobrevive).
- `GET .../activity`:
  - orden cronologico inverso, desempate por id en el mismo milisegundo;
  - cada entrada trae actor `{ id, name }` y `createdAt`;
  - VIEWER -> 200; no miembro -> 404; item de otro proyecto -> 404;
    item inexistente -> 404; sin sesion -> 401;
  - 100 filas -> `truncated: false`; 101 filas -> 100 entradas y
    `truncated: true`;
  - `field = 'assigneeId'` devuelve nombres, nunca ids.
- `summary.integration.test.ts` sigue verde tras extraer el helper.

### API — unitarias (`work-item.service.test.ts`)

- `activity`: 404 para no miembro, 403 sin permiso, 404 si el item no existe,
  mapeo a DTO.

### Web — `describeActivity.test.ts`

- Un caso por fila de la tabla de la decision 4 (contexto `item`) y los
  equivalentes de contexto `project`.
- Campo desconocido -> "actualizó el ítem".
- Ninguna frase contiene `IN_PROGRESS`, `assigneeId`, `dueDate` ni una fecha
  ISO.

### Web — componentes

- `WorkItemDetail.test.tsx`: historial con entradas (actor, frase, fecha),
  vacio, error con reintento, 404/403 no disponible, nota de truncado.
- `WorkItemHistory.test.tsx`: la seccion vive en su propio componente.
- `activityInvalidation.test.tsx` (estilo `summaryInvalidation.test.tsx`):
  editar, mover la tarjeta y comentar invalidan el historial; eliminar lo
  invalida sin volver a pedirlo.
- `ProjectSummaryPage.test.tsx` ajustado a la nueva redaccion.

## Verificacion

- `npm run lint`, `npm run typecheck`, `npm run test:unit` y
  `npm run test:integration` verdes.
- Manual: editar titulo y prioridad, mover la tarjeta y comentar; el
  historial del item muestra las frases en orden inverso con actor y fecha, y
  el panel del proyecto sigue mostrando su actividad reciente.
