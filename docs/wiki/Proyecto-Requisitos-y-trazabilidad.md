# Proyecto - Requisitos y trazabilidad

Cada requisito de las entregas es un item de Jira con el mismo ID que aparece en
su rama, sus commits y su Pull Request. Esta tabla une las cuatro cosas: el
item, sus criterios de aceptación, el PR que lo implementó y las pruebas que lo
verifican.

- **Criterios de aceptación** (Dado/Cuando/Entonces): en el
  [backlog](https://github.com/MiraPdS/mira/blob/develop/docs/backlog.md), con
  el mismo ID.
- **Tablero:** [Jira MIR](https://bolgunn.atlassian.net/jira/software/projects/MIR/boards).
- **Regla del equipo:** cada PR que cierra una historia agrega o actualiza su
  fila aquí (casilla en la
  [plantilla de PR](https://github.com/MiraPdS/mira/blob/develop/.github/pull_request_template.md)).

Niveles de prueba: **U** unitario · **I** integración · **C** componente ·
**E** end-to-end (Entrega 3, ver [Pruebas E2E](#pruebas-e2e-entrega-3)). Ver
[Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

**Estado al cierre de la Entrega 1** (tag
[`v1.0-entrega1`](https://github.com/MiraPdS/mira/releases/tag/v1.0-entrega1)):
✅ incluido en el release · ➡️ queda fuera del tag (se entrega después).
Los items incluidos en la Entrega 2 se marcan ✅ `v2.0-entrega2`, verificados
contra el [tag publicado](https://github.com/MiraPdS/mira/tree/v2.0-entrega2)
sobre el merge commit `9d2e518` del [#57]. La evidencia posterior del release
está en [Entrega 2](Entrega-2.md#cierre-del-release-mir-57).

## Épica 1 — Autenticación y cuenta de usuario

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-1 | Registro de usuario (API) | ✅ v1.0-entrega1 | andamiaje inicial | U [auth.service], [auth (shared)], [permissions] · I [auth.integration] |
| MIR-2 | Pantalla de registro | ✅ v1.0-entrega1 | [#5], [#6] | C [RegisterPage] |
| MIR-3 | Inicio de sesión | ✅ v1.0-entrega1 | andamiaje inicial | U [auth.service] · I [auth.integration] · C [LoginPage] |
| MIR-4 | Cerrar sesión y sesión persistente | ✅ v1.0-entrega1 | [#8] | C [LogoutButton], [guards], [query-client] |

## Épica 2 — Proyectos y equipo

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-5 | Crear proyecto | ✅ v1.0-entrega1 | [#3], [#18] | U [projects.service], [project (shared)] · I [projects.integration] · C [CreateProjectPage] |
| MIR-6 | Listar mis proyectos | ✅ v1.0-entrega1 | [#11] | U [projects.service] · I [projects.integration] · C [ProjectsPage] |
| MIR-7 | Ver y editar un proyecto | ✅ v1.0-entrega1 | [#19] | U [projects.service] · I [projects.integration] · C [ProjectSettingsPage] |
| MIR-8 | Eliminar un proyecto | ✅ v1.0-entrega1 | [#25] | U [projects.service] · I [projects.delete.integration] · C [ProjectSettingsPage], [useProjects] |
| MIR-9 | Invitar a un miembro | ✅ v1.0-entrega1 | [#10] | U [projects.service] · I [projects.members.integration] · C [InviteMemberForm] |
| MIR-10 | Cambiar rol y quitar miembros | ✅ v1.0-entrega1 | [#13] | U [projects.service] · I [projects.members.integration] · C [ProjectMembersPage] |

## Épica 3 — Elementos de trabajo

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-11 | Crear un elemento de trabajo | ✅ v1.0-entrega1 | [#1], [#28] | U [work-item.service] · I [work-item.integration] · C [CreateWorkItemForm] |
| MIR-12 | Listar el backlog con paginación | ✅ v1.0-entrega1 | [#2], [#28] | U [work-item.service] · I [work-item.integration] · C [WorkItemBacklog] |
| MIR-13 | Buscar y filtrar el backlog | ✅ v1.0-entrega1 | [#12] | U [work-item.service], [work-item.repository] · I [work-item.integration] · C [WorkItemBacklog] |
| MIR-14 | Ver el detalle de un elemento | ✅ v1.0-entrega1 | [#4] | U [work-item.service] · I [work-item.integration] · C [WorkItemDetail] |
| MIR-15 | Editar un elemento de trabajo | ✅ v1.0-entrega1 | [#9] | U [work-item.service] · I [work-item.integration] · C [WorkItemDetail] |
| MIR-16 | Eliminar un elemento de trabajo | ✅ v1.0-entrega1 | [#14] | U [work-item.service] · I [work-item.integration] · C [WorkItemDetail] |
| MIR-17 | Asignar un responsable | ✅ v1.0-entrega1 | [#27] | U [work-item.service] · I [work-item.assign.integration] · C [WorkItemDetail] |
| MIR-30 | Crear desde el tablero y abrir el detalle desde el backlog | ✅ v1.0-entrega1 | [#35] | C [ProjectBoardPage], [ProjectBacklogPage], [App] |

## Épica 4 — Tablero Kanban

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-18 | Visualizar el tablero | ✅ v1.0-entrega1 | [#16] | U [work-item.service] · I [work-item.integration] · C [KanbanBoard], [boardInvalidation] |
| MIR-19 | Cambiar el estado desde el menú | ✅ v1.0-entrega1 | [#20] | U [work-item.service] · I [work-item.integration] · C [KanbanBoard] |
| MIR-20 | Arrastrar y soltar tarjetas | ✅ v1.0-entrega1 | [#22] | C [KanbanBoard.dnd] |
| MIR-31 | Migrar los estados a columnas por proyecto | ✅ v2.0-entrega2 | [#40] | U [domain (shared)], [work-item (shared)], [work-item.service], [work-item.repository], [projects.service] · I [board-columns.integration], [board-columns.migration], [work-item.integration], [summary.integration] |
| MIR-48 | Crear, renombrar, reordenar y eliminar columnas | ✅ v2.0-entrega2 | [#44] | U [board-column.service], [board-column (shared)], [permissions] · I [board-column.integration] |
| MIR-49 | Tablero y backlog con las columnas del proyecto | ✅ v2.0-entrega2 | [#41] | U [work-item.service], [domain (shared)] · I [board-columns.migration], [work-item.integration], [summary.integration] · C [KanbanBoard], [KanbanBoard.dnd], [ProjectBoardPage], [ProjectBacklogPage], [WorkItemBacklog], [ProjectSummaryPage], [describeActivity] |
| MIR-50 | Pantalla de configuración de columnas | ✅ v2.0-entrega2 | [#46] | C [BoardColumnsSettings] (OWNER agrega, renombra, reordena y elimina; eliminar con elementos pide la columna de destino; MEMBER y VIEWER ven sin modificar), [ProjectSettingsPage] |

## Épica 5 — Colaboración y trazabilidad

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-21 | Comentar un elemento | ✅ v1.0-entrega1 | [#15] | U [comment.service] · I [comment.integration] · C [WorkItemComments] |
| MIR-22 | Historial de cambios de un elemento | ✅ v1.0-entrega1 | [#29] | U [work-item.service], [describeActivity], [activity (shared)] · I [work-item.activity.integration], [summary.integration] · C [WorkItemHistory], [activityInvalidation], [App] |
| MIR-23 | Panel del proyecto | ✅ v1.0-entrega1 | [#17] | U [projects.service] · I [summary.integration] · C [ProjectSummaryPage], [summaryInvalidation] |

## Épica 6 — Calidad, infraestructura y entrega

| Item | Tarea | Estado | PR | Verificación |
| --- | --- | --- | --- | --- |
| MIR-24 | Diseño responsive | ✅ v1.0-entrega1 | [#23] | C [KanbanBoard.dnd]; revisión manual a 375 px |
| MIR-25 | Protección de `main` y CI en PRs | ✅ v1.0-entrega1 | andamiaje inicial | [`ci.yml`] como check obligatorio de `main` |
| MIR-26 | Wiki del proyecto | ✅ v1.0-entrega1 | [#26] | `verificar` de [`wiki.yml`]; sin pendientes en el PR de release |
| MIR-27 | Despliegue del ambiente de demostración | ✅ v1.0-entrega1 | [#24] | I [health.integration]; [demo](https://mira-pds.vercel.app/api/health) |
| MIR-28 | Release `v1.0-entrega1` | ✅ v1.0-entrega1 | [#31], [#32] | [Evidencias de la Entrega 1](Evidencias-Entrega-1.md); [release](https://github.com/MiraPdS/mira/releases/tag/v1.0-entrega1) |
| MIR-29 | Cápsula de video | ➡️ después del tag | — | se graba sobre el release desplegado |
| MIR-55 | Umbral de cobertura que rompe el build | ✅ v2.0-entrega2 | [#43] | umbral en [`vitest.config.ts`] y [estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md#cobertura); Actions: [run verde](https://github.com/MiraPdS/mira/actions/runs/40987420686) y [run rojo por umbral](https://github.com/MiraPdS/mira/actions/runs/40994045311) (`467f5bd`, 947/947 tests en verde, statements 97,06 % < 99 %) |
| MIR-56 | Wiki de la Entrega 2 | ✅ v2.0-entrega2 | [#54] | `verificar` de [`wiki.yml`]; [Entrega 2](Entrega-2.md) con objetivo, arquitectura, pipeline, integraciones, pruebas, problemas y evidencias |
| MIR-57 | Release `v2.0-entrega2` | ✅ v2.0-entrega2 | [#57] | [CI 41563910260](https://github.com/MiraPdS/mira/actions/runs/41563910260): cuatro jobs en success; [tag](https://github.com/MiraPdS/mira/tree/v2.0-entrega2) sobre `9d2e518`; [GitHub Release](https://github.com/MiraPdS/mira/releases/tag/v2.0-entrega2) publicado; [cierre y despliegue verificado](Entrega-2.md#cierre-del-release-mir-57) |

## Épica 7 — Sprints

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-43 | Modelo y API de Sprints | ✅ v2.0-entrega2 | [#39] | U [sprint.service], [sprint (shared)], [permissions] · I [sprint.integration] |
| MIR-44 | Pantalla de Sprints | ✅ v2.0-entrega2 | [#42] | U [useSprints] · C [ProjectSprintsPage], [ProjectSummaryPage] |
| MIR-45 | Asignar elementos a un sprint | ✅ v2.0-entrega2 | [#47] | U [work-item.sprint.service], [activity], [work-item-sprint (shared)], [describeActivity] · I [work-item.sprint.integration] · C [WorkItemSprint] |
| MIR-46 | Iniciar y cerrar un sprint | ✅ v2.0-entrega2 | [#48] | U [sprint.lifecycle.service], [sprint-lifecycle (shared)], [prisma-conflicts] · I [sprint.lifecycle.integration], [sprint.lifecycle.migration] · C [SprintLifecycle] |
| MIR-47 | Tablero del sprint activo | ✅ v2.0-entrega2 | [#50] | C [ProjectBoardPage.sprint] (con sprint activo solo sus elementos y su nombre y fechas; «Todos los elementos» quita el filtro; sin sprint activo, el tablero de la Entrega 1), [ProjectBoardPage] |

## Integración y despliegue continuo (épica MIR-40)

| Item | Tarea | Estado | PR | Verificación |
| --- | --- | --- | --- | --- |
| MIR-33 | CI/CD oficial en GitHub Actions | ✅ v2.0-entrega2 | [#45], [#49] | environment `deploy` solo para `main`, `enforce_admins` y secretos según [`docs/ci-cd.md`]; comandos de verificación en la misma página |
| MIR-51 | Reportes JUnit del pipeline como artefacto | ✅ v2.0-entrega2 | [#51] | artefacto `reporte-junit` en cada ejecución de [`ci.yml`], también con pruebas fallidas |
| MIR-52 | Webhook de GitHub y estado en el commit | ➡️ cerrado sin trabajo | — | Actions publica el estado de cada job en el commit y en el PR; ver [D14](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d14--github-actions-como-cicd-oficial) |
| MIR-53 | Notificaciones a Discord | ✅ v2.0-entrega2 | [#53] | Actions: [fallo con aviso](https://github.com/MiraPdS/mira/actions/runs/41380199238) y [recuperación con aviso](https://github.com/MiraPdS/mira/actions/runs/41380480549); aviso de despliegue aceptado en [CI 41563910260](https://github.com/MiraPdS/mira/actions/runs/41563910260) (MIR-57) |
| MIR-54 | Despliegue desde GitHub Actions | ✅ v2.0-entrega2 | [#52] | job `Desplegar` de [`ci.yml`], _Skipped_ fuera de `main`; [CI 41563910260](https://github.com/MiraPdS/mira/actions/runs/41563910260) exitoso; un deploy por Deploy Hook del commit `9d2e518` en Render Live y Vercel Production Ready, sin duplicados (MIR-57) |

## Pruebas E2E (Entrega 3)

### Historia → spec E2E

Qué historias de las entregas anteriores quedan cubiertas por un E2E, además
de sus pruebas U, I y C de las tablas de arriba. Todas corren en el job `E2E`
de cada PR; las marcadas `@humo` corren también contra la demo después de cada
despliegue.

| Historia | Spec E2E | Qué se verifica en el navegador |
| --- | --- | --- |
| MIR-1, MIR-2 Registro | [autenticacion](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/autenticacion.spec.ts) | Registro nuevo entra con sesión; correo repetido muestra el error y no entra |
| MIR-3 Inicio de sesión | [autenticacion](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/autenticacion.spec.ts), [humo](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/humo.spec.ts) `@humo` | Contraseña incorrecta da el mensaje genérico; login entra a Mis proyectos; login en la demo |
| MIR-4 Cerrar sesión y sesión persistente | [autenticacion](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/autenticacion.spec.ts) | Recargar mantiene la sesión; cerrar sesión vuelve a pedir login |
| MIR-5 Crear proyecto | [proyectos-permisos](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/proyectos-permisos.spec.ts) | Clave válida crea el proyecto; clave inválida y repetida muestran su error y no crean nada |
| MIR-6 Listar mis proyectos | [proyectos-permisos](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/proyectos-permisos.spec.ts) | El proyecto nuevo aparece como Propietario; grace ve `MIR` como Observador |
| MIR-7 Ver y editar un proyecto, permisos por rol (D7) | [proyectos-permisos](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/proyectos-permisos.spec.ts) | VIEWER no ve "Crear elemento" ni edición de proyecto o columnas; OWNER sí (contraprueba) |
| MIR-11, 12, 14, 15, 16 CRUD de elementos | [elementos](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/elementos.spec.ts) | Crear, ver en el backlog, consultar, editar y eliminar; crear sin título no crea nada |
| MIR-13 Buscar y filtrar el backlog | [backlog](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/backlog.spec.ts) | Texto, estado, prioridad y responsable, combinados; "Limpiar filtros" |
| MIR-18 Visualizar el tablero | [humo](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/humo.spec.ts) `@humo`, [tablero](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/tablero.spec.ts) | El tablero de `MIR` muestra sus columnas |
| MIR-19 Cambiar el estado desde el menú | [tablero](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/tablero.spec.ts) `@movil` | "Mover a…" cambia la columna y persiste al recargar, en escritorio y en móvil |
| MIR-21 Comentar un elemento | [backlog](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/backlog.spec.ts) | El comentario aparece con autor y fecha sin recargar y persiste |
| MIR-22 Historial | [tablero](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/tablero.spec.ts) | El movimiento hecho en el tablero aparece en el historial del elemento |
| MIR-23, MIR-24 Panel y diseño responsive | [movil](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/movil.spec.ts) | A 375 px: proyectos → resumen → backlog → tablero → sprints, sin scroll horizontal ni errores de la API; el tablero se desplaza dentro de su región |
| MIR-43 a MIR-47 Sprints | [sprints](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/sprints.spec.ts) | Crear, asignar un elemento, iniciar, tablero del sprint activo y cerrar con trabajo pendiente |
| MIR-48, MIR-50 Columnas configurables | [columnas](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/columnas.spec.ts) | Agregar y reordenar se refleja en el tablero y persiste; sin nombre se rechaza; eliminar con elementos pide destino y los mueve |

MIR-8 (eliminar proyecto), MIR-9 y MIR-10 (miembros), MIR-17 (responsable),
MIR-20 (arrastre) y MIR-30 no tienen E2E propio: siguen cubiertas por sus
pruebas U, I y C. El arrastre queda fuera a propósito, ver
[Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md#por-qué-los-e2e-no-arrastran-tarjetas).

### Items de la épica MIR-59

Estado al cierre de la Entrega 3: ✅ fusionado en `develop` para el release
`v3.0-entrega3` (MIR-76).

| Item | Tarea | Estado | PR | Verificación |
| --- | --- | --- | --- | --- |
| MIR-60 | Alcance de D14 en la Entrega 3 y D15 Playwright | ✅ | [#62](https://github.com/MiraPdS/mira/pull/62) | [D14](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d14--github-actions-como-cicd-oficial) y [D15](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d15--playwright-como-herramienta-e2e), con la confirmación del profesor |
| MIR-61 | Andamiaje de Playwright | ✅ | [#61](https://github.com/MiraPdS/mira/pull/61) | E [ejemplo](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/ejemplo.spec.ts) (3 tests) |
| MIR-62 | Job E2E en GitHub Actions como check obligatorio | ✅ | [#64](https://github.com/MiraPdS/mira/pull/64), [#69](https://github.com/MiraPdS/mira/pull/69) | Rojo controlado en [#66](https://github.com/MiraPdS/mira/pull/66): [run rojo](https://github.com/MiraPdS/mira/actions/runs/44657161160) y [run verde](https://github.com/MiraPdS/mira/actions/runs/44658912087) |
| MIR-63 | E2E de autenticación y sesión | ✅ | [#63](https://github.com/MiraPdS/mira/pull/63) | E [autenticacion](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/autenticacion.spec.ts) (5 tests) |
| MIR-64 | E2E del CRUD de elementos | ✅ | [#67](https://github.com/MiraPdS/mira/pull/67) | E [elementos](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/elementos.spec.ts) (2 tests) |
| MIR-65 | E2E de proyectos y permisos | ✅ | [#65](https://github.com/MiraPdS/mira/pull/65) | E [proyectos-permisos](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/proyectos-permisos.spec.ts) (10 tests) |
| MIR-66 | E2E de búsqueda, filtros y comentarios | ✅ | [#74](https://github.com/MiraPdS/mira/pull/74) | E [backlog](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/backlog.spec.ts) (4 tests) |
| MIR-67 | E2E del tablero y el historial | ✅ | [#73](https://github.com/MiraPdS/mira/pull/73) | E [tablero](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/tablero.spec.ts) (2 tests + 1 en móvil) |
| MIR-68 | E2E del ciclo de un sprint | ✅ | [#70](https://github.com/MiraPdS/mira/pull/70) | E [sprints](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/sprints.spec.ts) (1 test) |
| MIR-69 | E2E de columnas configurables | ✅ | [#75](https://github.com/MiraPdS/mira/pull/75) | E [columnas](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/columnas.spec.ts) (3 tests) |
| MIR-70 | E2E de navegación en móvil | ✅ | [#68](https://github.com/MiraPdS/mira/pull/68) | E [movil](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/movil.spec.ts) (2 tests, solo móvil) |
| MIR-71 | Commit desplegado en `/api/health` | ✅ | [#71](https://github.com/MiraPdS/mira/pull/71) | `/api/health` informa `commit`; `Desplegar` espera a que coincida |
| MIR-72 | Humo E2E contra la demo desplegada | ✅ | [#72](https://github.com/MiraPdS/mira/pull/72) | E [humo](https://github.com/MiraPdS/mira/blob/develop/e2e/specs/humo.spec.ts) `@humo` (2 tests); job `Humo E2E` en cada push a `main` |
| MIR-73 | Actions con Node 24 | ✅ | [#76](https://github.com/MiraPdS/mira/pull/76) | `checkout`, `setup-node` y `upload-artifact` en v7 en [`ci.yml`] |
| MIR-74 | Defectos encontrados por los E2E | ➡️ sin defectos | — | Los E2E no destaparon defectos de la aplicación; no se abrió ningún Bug |
| MIR-75 | Wiki de la Entrega 3 | ✅ | [#77](https://github.com/MiraPdS/mira/pull/77) | [Entrega 3](Entrega-3.md) con los ocho puntos del Anexo B; `verificar` de [`wiki.yml`] |
| MIR-76 | Release `v3.0-entrega3` | ✅ v3.0-entrega3 | [#78](https://github.com/MiraPdS/mira/pull/78), [#81](https://github.com/MiraPdS/mira/pull/81) | [Evidencias de la Entrega 3](Evidencias-Entrega-3.md); [release](https://github.com/MiraPdS/mira/releases/tag/v3.0-entrega3); `Desplegar` y `Humo E2E` en el [run 45537008110](https://github.com/MiraPdS/mira/actions/runs/45537008110) |
| MIR-77 | Cápsula de video de la Entrega 3 | ✅ | [#80](https://github.com/MiraPdS/mira/pull/80) | [Video](https://youtu.be/eX3-Vx8km5Q) ([issue #79](https://github.com/MiraPdS/mira/issues/79)) |

Suite completa en verde en `develop`:
[run 44676923221](https://github.com/MiraPdS/mira/actions/runs/44676923221),
`38 passed`.

<!-- Enlaces de referencia: PRs -->

[#1]: https://github.com/MiraPdS/mira/pull/1
[#2]: https://github.com/MiraPdS/mira/pull/2
[#3]: https://github.com/MiraPdS/mira/pull/3
[#4]: https://github.com/MiraPdS/mira/pull/4
[#5]: https://github.com/MiraPdS/mira/pull/5
[#6]: https://github.com/MiraPdS/mira/pull/6
[#8]: https://github.com/MiraPdS/mira/pull/8
[#9]: https://github.com/MiraPdS/mira/pull/9
[#10]: https://github.com/MiraPdS/mira/pull/10
[#11]: https://github.com/MiraPdS/mira/pull/11
[#12]: https://github.com/MiraPdS/mira/pull/12
[#13]: https://github.com/MiraPdS/mira/pull/13
[#14]: https://github.com/MiraPdS/mira/pull/14
[#15]: https://github.com/MiraPdS/mira/pull/15
[#16]: https://github.com/MiraPdS/mira/pull/16
[#17]: https://github.com/MiraPdS/mira/pull/17
[#18]: https://github.com/MiraPdS/mira/pull/18
[#19]: https://github.com/MiraPdS/mira/pull/19
[#20]: https://github.com/MiraPdS/mira/pull/20
[#22]: https://github.com/MiraPdS/mira/pull/22
[#23]: https://github.com/MiraPdS/mira/pull/23
[#24]: https://github.com/MiraPdS/mira/pull/24
[#25]: https://github.com/MiraPdS/mira/pull/25
[#26]: https://github.com/MiraPdS/mira/pull/26
[#27]: https://github.com/MiraPdS/mira/pull/27
[#28]: https://github.com/MiraPdS/mira/pull/28
[#29]: https://github.com/MiraPdS/mira/pull/29
[#31]: https://github.com/MiraPdS/mira/pull/31
[#32]: https://github.com/MiraPdS/mira/pull/32
[#35]: https://github.com/MiraPdS/mira/pull/35
[#39]: https://github.com/MiraPdS/mira/pull/39
[#40]: https://github.com/MiraPdS/mira/pull/40
[#41]: https://github.com/MiraPdS/mira/pull/41
[#42]: https://github.com/MiraPdS/mira/pull/42
[#43]: https://github.com/MiraPdS/mira/pull/43
[#44]: https://github.com/MiraPdS/mira/pull/44
[#46]: https://github.com/MiraPdS/mira/pull/46
[#47]: https://github.com/MiraPdS/mira/pull/47
[#48]: https://github.com/MiraPdS/mira/pull/48
[#50]: https://github.com/MiraPdS/mira/pull/50
[#45]: https://github.com/MiraPdS/mira/pull/45
[#49]: https://github.com/MiraPdS/mira/pull/49
[#51]: https://github.com/MiraPdS/mira/pull/51
[#52]: https://github.com/MiraPdS/mira/pull/52
[#53]: https://github.com/MiraPdS/mira/pull/53
[#54]: https://github.com/MiraPdS/mira/pull/54
[#57]: https://github.com/MiraPdS/mira/pull/57

<!-- Enlaces de referencia: pruebas y workflows -->

[`ci.yml`]: https://github.com/MiraPdS/mira/blob/develop/.github/workflows/ci.yml
[`docs/ci-cd.md`]: https://github.com/MiraPdS/mira/blob/develop/docs/ci-cd.md
[`vitest.config.ts`]: https://github.com/MiraPdS/mira/blob/develop/vitest.config.ts
[`wiki.yml`]: https://github.com/MiraPdS/mira/blob/develop/.github/workflows/wiki.yml
[auth (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/auth.test.ts
[project (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/project.test.ts
[sprint.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/sprints/sprint.service.test.ts
[sprint (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/sprint.test.ts
[sprint.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/sprints/sprint.integration.test.ts
[work-item.sprint.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.sprint.service.test.ts
[work-item.sprint.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.sprint.integration.test.ts
[activity]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/lib/activity.test.ts
[work-item-sprint (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/work-item-sprint.test.ts
[domain (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/domain.test.ts
[work-item (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/work-item.test.ts
[board-columns.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/board-columns.integration.test.ts
[board-columns.migration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/board-columns.migration.integration.test.ts
[board-column.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/board-columns/board-column.service.test.ts
[board-column (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/board-column.test.ts
[board-column.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/board-columns/board-column.integration.test.ts
[useSprints]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/sprints/useSprints.test.ts
[ProjectSprintsPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/sprints/ProjectSprintsPage.test.tsx
[permissions]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/permissions.test.ts
[auth.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/auth/auth.service.test.ts
[auth.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/auth/auth.integration.test.ts
[comment.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/comments/comment.service.test.ts
[comment.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/comments/comment.integration.test.ts
[health.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/health/health.integration.test.ts
[projects.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/projects/projects.service.test.ts
[projects.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/projects/projects.integration.test.ts
[projects.delete.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/projects/projects.delete.integration.test.ts
[projects.members.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/projects/projects.members.integration.test.ts
[summary.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/projects/summary.integration.test.ts
[work-item.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.service.test.ts
[work-item.repository]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.repository.test.ts
[work-item.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.integration.test.ts
[RegisterPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/auth/RegisterPage.test.tsx
[LoginPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/auth/LoginPage.test.tsx
[LogoutButton]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/auth/LogoutButton.test.tsx
[guards]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/auth/guards.test.tsx
[query-client]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/lib/query-client.test.ts
[BoardColumnsSettings]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/board/BoardColumnsSettings.test.tsx
[KanbanBoard]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/board/KanbanBoard.test.tsx
[KanbanBoard.dnd]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/board/KanbanBoard.dnd.test.tsx
[boardInvalidation]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/board/boardInvalidation.test.tsx
[CreateProjectPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/CreateProjectPage.test.tsx
[InviteMemberForm]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/InviteMemberForm.test.tsx
[ProjectMembersPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectMembersPage.test.tsx
[ProjectSettingsPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectSettingsPage.test.tsx
[ProjectSummaryPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectSummaryPage.test.tsx
[ProjectsPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectsPage.test.tsx
[useProjects]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/useProjects.test.tsx
[CreateWorkItemForm]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/CreateWorkItemForm.test.tsx
[WorkItemBacklog]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/WorkItemBacklog.test.tsx
[WorkItemComments]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/WorkItemComments.test.tsx
[WorkItemDetail]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/WorkItemDetail.test.tsx
[WorkItemSprint]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/WorkItemSprint.test.tsx
[summaryInvalidation]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/summaryInvalidation.test.tsx
[describeActivity]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/activity/describeActivity.test.ts
[activity (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/activity.test.ts
[work-item.activity.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.activity.integration.test.ts
[WorkItemHistory]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/WorkItemHistory.test.tsx
[activityInvalidation]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/activityInvalidation.test.tsx
[App]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/App.test.tsx
[ProjectBoardPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectBoardPage.test.tsx
[ProjectBoardPage.sprint]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectBoardPage.sprint.test.tsx
[ProjectBacklogPage]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/projects/ProjectBacklogPage.test.tsx
[work-item.assign.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/work-items/work-item.assign.integration.test.ts
[sprint.lifecycle.service]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/sprints/sprint.lifecycle.service.test.ts
[sprint-lifecycle (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/sprint-lifecycle.test.ts
[prisma-conflicts]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/lib/prisma-conflicts.test.ts
[sprint.lifecycle.integration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/sprints/sprint.lifecycle.integration.test.ts
[sprint.lifecycle.migration]: https://github.com/MiraPdS/mira/blob/develop/apps/api/src/modules/sprints/sprint.lifecycle.migration.integration.test.ts
[SprintLifecycle]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/sprints/SprintLifecycle.test.tsx

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->
