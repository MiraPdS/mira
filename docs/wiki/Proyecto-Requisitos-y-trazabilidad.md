# Proyecto - Requisitos y trazabilidad

Cada requisito de la Entrega 1 es un item de Jira con el mismo ID que aparece en
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

Niveles de prueba: **U** unitario · **I** integración · **C** componente. Ver
[Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

> ⏳ Se completa en MIR-28: estado final de cada item al cerrar la Entrega 1.

## Épica 1 — Autenticación y cuenta de usuario

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-1 | Registro de usuario (API) | ✅ develop | andamiaje inicial | U [auth.service], [auth (shared)], [permissions] · I [auth.integration] |
| MIR-2 | Pantalla de registro | ✅ develop | [#5], [#6] | C [RegisterPage] |
| MIR-3 | Inicio de sesión | ✅ develop | andamiaje inicial | U [auth.service] · I [auth.integration] · C [LoginPage] |
| MIR-4 | Cerrar sesión y sesión persistente | ✅ develop | [#8] | C [LogoutButton], [guards], [query-client] |

## Épica 2 — Proyectos y equipo

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-5 | Crear proyecto | ✅ develop | [#3], [#18] | U [projects.service], [project (shared)] · I [projects.integration] · C [CreateProjectPage] |
| MIR-6 | Listar mis proyectos | ✅ develop | [#11] | U [projects.service] · I [projects.integration] · C [ProjectsPage] |
| MIR-7 | Ver y editar un proyecto | ✅ develop | [#19] | U [projects.service] · I [projects.integration] · C [ProjectSettingsPage] |
| MIR-8 | Eliminar un proyecto | ✅ develop | [#25] | U [projects.service] · I [projects.delete.integration] · C [ProjectSettingsPage], [useProjects] |
| MIR-9 | Invitar a un miembro | ✅ develop | [#10] | U [projects.service] · I [projects.members.integration] · C [InviteMemberForm] |
| MIR-10 | Cambiar rol y quitar miembros | ✅ develop | [#13] | U [projects.service] · I [projects.members.integration] · C [ProjectMembersPage] |

## Épica 3 — Elementos de trabajo

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-11 | Crear un elemento de trabajo | ✅ develop | [#1] | U [work-item.service] · I [work-item.integration] · C [CreateWorkItemForm] |
| MIR-12 | Listar el backlog con paginación | ✅ develop | [#2] | U [work-item.service] · I [work-item.integration] · C [WorkItemBacklog] |
| MIR-13 | Buscar y filtrar el backlog | ✅ develop | [#12] | U [work-item.service], [work-item.repository] · I [work-item.integration] · C [WorkItemBacklog] |
| MIR-14 | Ver el detalle de un elemento | ✅ develop | [#4] | U [work-item.service] · I [work-item.integration] · C [WorkItemDetail] |
| MIR-15 | Editar un elemento de trabajo | ✅ develop | [#9] | U [work-item.service] · I [work-item.integration] · C [WorkItemDetail] |
| MIR-16 | Eliminar un elemento de trabajo | ✅ develop | [#14] | U [work-item.service] · I [work-item.integration] · C [WorkItemDetail] |
| MIR-17 | Asignar un responsable | ⏳ pendiente | — | ⏳ |

## Épica 4 — Tablero Kanban

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-18 | Visualizar el tablero | ✅ develop | [#16] | U [work-item.service] · I [work-item.integration] · C [KanbanBoard], [boardInvalidation] |
| MIR-19 | Cambiar el estado desde el menú | ✅ develop | [#20] | U [work-item.service] · I [work-item.integration] · C [KanbanBoard] |
| MIR-20 | Arrastrar y soltar tarjetas | ✅ develop | [#22] | C [KanbanBoard.dnd] |

## Épica 5 — Colaboración y trazabilidad

| Item | Historia | Estado | PR | Pruebas |
| --- | --- | --- | --- | --- |
| MIR-21 | Comentar un elemento | ✅ develop | [#15] | U [comment.service] · I [comment.integration] · C [WorkItemComments] |
| MIR-22 | Historial de cambios de un elemento | ⏳ pendiente | — | ⏳ |
| MIR-23 | Panel del proyecto | ✅ develop | [#17] | U [projects.service] · I [summary.integration] · C [ProjectSummaryPage], [summaryInvalidation] |

## Épica 6 — Calidad, infraestructura y entrega

| Item | Tarea | Estado | PR | Verificación |
| --- | --- | --- | --- | --- |
| MIR-24 | Diseño responsive | ✅ develop | [#23] | C [KanbanBoard.dnd]; revisión manual a 375 px |
| MIR-25 | Protección de `main` y CI en PRs | ✅ develop | andamiaje inicial | [`ci.yml`] como check obligatorio de `main` |
| MIR-26 | Wiki del proyecto | 🔄 en curso | ⏳ | `verificar` de [`wiki.yml`] |
| MIR-27 | Despliegue del ambiente de demostración | ✅ develop | [#24] | I [health.integration]; [demo](https://mira-pds.vercel.app/api/health) |
| MIR-28 | Release `v1.0-entrega1` | ⏳ pendiente | — | ⏳ |
| MIR-29 | Cápsula de video | ⏳ pendiente | — | ⏳ |

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

<!-- Enlaces de referencia: pruebas y workflows -->

[`ci.yml`]: https://github.com/MiraPdS/mira/blob/develop/.github/workflows/ci.yml
[`wiki.yml`]: https://github.com/MiraPdS/mira/blob/develop/.github/workflows/wiki.yml
[auth (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/auth.test.ts
[project (shared)]: https://github.com/MiraPdS/mira/blob/develop/packages/shared/src/schemas/project.test.ts
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
[summaryInvalidation]: https://github.com/MiraPdS/mira/blob/develop/apps/web/src/features/work-items/summaryInvalidation.test.tsx

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->
