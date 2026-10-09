# Proyecto - Supuestos y dependencias

Condiciones que el equipo asumió al construir Mira y factores externos que
pueden afectar el proyecto. Cada uno tiene un ID estable para poder citarlo
desde las páginas de entrega ("aplica S-03") y una fuente verificable.

Los IDs no se reutilizan: si un supuesto deja de valer, se marca como
**retirado** y se explica por qué, sin borrar la fila.

## Supuestos

### Alcance

| ID | Supuesto | Riesgo si no se cumple / mitigación | Fuente |
| --- | --- | --- | --- |
| S-01 | Los Sprints, aunque los pide el enunciado, se difieren a la Entrega 2 (MIR-30). La Entrega 1 se centra en el CRUD y el tablero. | Que se evalúe como requisito faltante. Mitigación: se declara aquí y en la página de la Entrega 1; `WorkItem.sprintId` ya existe como campo opcional, así que sumarlos no rompe datos. | [Tema 2](https://github.com/MiraPdS/mira/blob/develop/requirements/tema2.md), [backlog](https://github.com/MiraPdS/mira/blob/develop/docs/backlog.md#reservado-para-la-entrega-2) |
| S-02 | Las columnas del tablero son fijas en la Entrega 1 (`BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`); hacerlas configurables es requerimiento de la Entrega 2 (MIR-31). | Un equipo con otro flujo no puede adaptarlo aún. Mitigación: la migración de enum a tabla está prevista y aislada. | [D8](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d8--estados-del-tablero-como-enum-fijo) |
| S-03 | No hay organizaciones ni multi-equipo: cada proyecto es independiente (MIR-32 en la Entrega 2). | Proyectos de una misma empresa no se agrupan. Mitigación: `Project.organizationId` ya existe como campo opcional. | [backlog](https://github.com/MiraPdS/mira/blob/develop/docs/backlog.md#reservado-para-la-entrega-2) |
| S-04 | Los roles son tres y fijos por proyecto: `OWNER`, `MEMBER`, `VIEWER`. No hay roles configurables ni rol global de administrador. | Un permiso intermedio no se puede expresar. Mitigación: toda la autorización pasa por `can()`, así que agregar un rol es un cambio en un solo lugar, cubierto por la prueba de tabla. | [D7](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d7--roles-por-proyecto-y-una-función-can-pura) |

### Producto

| ID | Supuesto | Riesgo si no se cumple / mitigación | Fuente |
| --- | --- | --- | --- |
| S-05 | La interfaz es solo en español. | Usuarios de otro idioma. Mitigación: los textos están en los componentes; internacionalizar es trabajo acotado si se pide. | — |
| S-06 | No hay verificación de correo ni recuperación de contraseña: no se envían correos. | Un usuario que olvida su clave no puede recuperarla por sí mismo. Mitigación: aceptable para un MVP sin datos reales; se reevalúa si Mira se usa fuera del ramo. | rutas de `auth`: solo `register`, `login`, `logout`, `me` |
| S-07 | Para agregar a alguien a un proyecto, esa persona ya debe tener cuenta: la "invitación" es por correo de un usuario existente, sin enlace ni correo de invitación. | Flujo menos natural que una invitación real. Mitigación: la API responde `USER_NOT_FOUND` y la UI lo explica. | MIR-9, `addMemberSchema` |
| S-08 | La sesión dura 7 días y no se renueva sola; no hay "cerrar sesión en todos los dispositivos". | Un token robado vale hasta que expira. Mitigación: cookie `httpOnly` (no la lee JavaScript), `Secure` y `SameSite=Lax`. | [D3](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d3--jwt-en-cookie-httponly), `lib/jwt.ts` |
| S-09 | Se usan navegadores modernos de escritorio y móvil (Chrome, Firefox, Safari, Edge recientes) con JavaScript habilitado. | Navegadores antiguos no funcionan. Mitigación: ninguna, fuera de alcance. | — |

### Ambiente de demostración

| ID | Supuesto | Riesgo si no se cumple / mitigación | Fuente |
| --- | --- | --- | --- |
| S-10 | El ambiente desplegado es una **demo**, no producción: solo datos de prueba y credenciales públicas a propósito (`ada@mira.dev` / `demo1234`). | Que alguien cargue datos reales. Mitigación: se advierte en README y aquí. | [`despliegue.md`](https://github.com/MiraPdS/mira/blob/develop/docs/despliegue.md#cosas-que-conviene-saber) |
| S-11 | La demo despliega solo la rama `main`, es decir, el último release. | Lo que está en `develop` no se ve en la demo hasta el release. Mitigación: despliegue manual de una rama para probar antes de un release. | [`despliegue.md`](https://github.com/MiraPdS/mira/blob/develop/docs/despliegue.md) |
| S-12 | Las previews de Vercel usan la misma API y la misma base que la demo. | Probar en una preview modifica los datos de la demo. Mitigación: las previews solo se usan para revisar cambios de frontend. | [D13](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d13--mismo-origen-mediante-rewrite-de-vercel) |

### Equipo y proceso

| ID | Supuesto | Riesgo si no se cumple / mitigación | Fuente |
| --- | --- | --- | --- |
| S-13 | Cada integrante tiene Node ≥ 20.11, npm ≥ 10 y Docker Desktop. | Sin Docker no corren las pruebas de integración en local. Mitigación: `npm run test:unit` funciona sin Docker, y CI corre todo. | [D6](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d6--docker-local-para-desarrollo-y-pruebas-supabase-para-lo-desplegado) |
| S-14 | Todo cambio entra a `develop` por PR revisado por otro integrante, y a `main` solo por PR de release con CI verde. | Cambios sin revisar. Mitigación: `main` protegida con checks obligatorios y una aprobación. | [CONTRIBUTING](https://github.com/MiraPdS/mira/blob/develop/CONTRIBUTING.md) |
| S-15 | La Wiki se edita solo desde `docs/wiki/` por PR; un workflow la sincroniza. | Una edición directa en GitHub se pierde en el siguiente sync. Mitigación: cada página lo advierte y está en CONTRIBUTING. | `.github/workflows/wiki.yml` |

## Dependencias externas

| ID | Dependencia | Para qué | Riesgo / mitigación |
| --- | --- | --- | --- |
| D-EXT-01 | **Vercel** (Hobby) | Servir el frontend y reenviar `/api` a Render | Cambio de condiciones del plan gratuito. Mitigación: SPA estática; se mueve a otro host cambiando solo el rewrite. |
| D-EXT-02 | **Render** (Free) | Ejecutar la API | Arranque en frío de 30-60 s tras 15 min sin tráfico; 750 h/mes por cuenta. Mitigación: pinger cada 5 min y un solo servicio free en la cuenta. |
| D-EXT-03 | **Supabase** (Free) | PostgreSQL del ambiente desplegado | Pausa del proyecto tras 7 días sin actividad. Mitigación: el pinger toca la base vía `/api/health`; si se pausa, "Restore project". |
| D-EXT-04 | **UptimeRobot** (Free) | Mantener despiertas la API y la base | Si deja de pinguear vuelven el arranque en frío y la pausa. Mitigación: abrir `/api/health` antes de cada demo. |
| D-EXT-05 | **GitHub** (repositorio, Actions, Wiki) | Código, CI obligatorio para `main`, Wiki | Caída o límite de minutos de Actions. Mitigación: repositorio público (minutos ilimitados); todo se puede correr en local. |
| D-EXT-06 | **Jira** (Atlassian Cloud) | Backlog, tablero Kanban y trazabilidad de items | Pérdida del tablero. Mitigación: `docs/backlog.md` y `jira-import.csv` permiten reimportarlo. |
| D-EXT-07 | **npm** y librerías clave: Prisma, Express, React, TanStack Query, dnd-kit, Zod, Vitest, React Testing Library, MSW, Supertest | Todo el código de la aplicación y sus pruebas | Cambio incompatible en una versión mayor. Mitigación: `package-lock.json` versionado y `npm ci` en CI y en los despliegues. |
| D-EXT-08 | **Docker** (`postgres:16`) | PostgreSQL local de desarrollo y pruebas, y servicio en CI | Sin Docker no hay pruebas de integración. En la Entrega 2 el agente de Jenkins también lo necesita ([D4](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d4--pirámide-de-pruebas-de-dos-niveles-en-el-backend)). |

## Limitaciones tecnológicas conocidas

- El arrastre de tarjetas es difícil de automatizar de forma estable con
  Selenium; por eso existe el menú "Mover a…" como camino alternativo
  ([D9](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d9--kanban-con-dnd-kit-y-un-camino-alternativo-obligatorio)).
- `prisma migrate` no funciona a través del pooler de Supabase y la conexión
  directa es solo IPv6, que Render no soporta: se usa el session pooler
  ([`despliegue.md`](https://github.com/MiraPdS/mira/blob/develop/docs/despliegue.md#variables-de-entorno)).
- Las migraciones corren mientras la versión anterior sigue atendiendo: borrar
  o renombrar columnas se hace en dos releases.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->
