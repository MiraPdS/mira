# Entrega 1

**Construcción inicial de la aplicación y pruebas automatizadas.**
Tag: `v1.0-entrega1` · Herramienta de testing: **Vitest + React Testing Library**.

## Objetivo de la entrega

Construir el MVP de Mira con el CRUD de sus funcionalidades principales,
trabajando con GitFlow y Kanban en Jira, y con pruebas automatizadas en tres
niveles (unitario, integración y componente) que corren en cada Pull Request.

## Alcance implementado (CRUD)

El enunciado pide seis operaciones sobre los elementos principales. En Mira el
elemento principal es el **elemento de trabajo** (historia, tarea, bug o épica);
los proyectos tienen además su propio CRUD.

| Operación del enunciado | En Mira | Item |
| --- | --- | --- |
| Listar elementos | Backlog paginado de un proyecto; tablero Kanban; lista de proyectos | MIR-12, MIR-18, MIR-6 |
| Buscar un elemento específico | Búsqueda por texto y filtros por tipo, estado, prioridad y responsable | MIR-13 |
| Visualizar el detalle | Detalle del elemento con comentarios | MIR-14, MIR-21 |
| Agregar un nuevo elemento | Crear elemento de trabajo; crear proyecto | MIR-11, MIR-5 |
| Editar un elemento existente | Editar elemento; mover entre estados; editar proyecto | MIR-15, MIR-19, MIR-20, MIR-7 |
| Eliminar un elemento | Eliminar elemento; eliminar proyecto | MIR-16, MIR-8 |

Además: registro e inicio de sesión, equipo y roles por proyecto, panel del
proyecto y diseño responsive. Estado de cada item en
[Requisitos y trazabilidad](Proyecto-Requisitos-y-trazabilidad.md).

Alcance final del release: **todas las historias planificadas para la
Entrega 1 (MIR-1 a MIR-24) están en el tag**, incluidas la asignación de
responsable (MIR-17, [#27](https://github.com/MiraPdS/mira/pull/27)) y el historial de cambios (MIR-22,
[#29](https://github.com/MiraPdS/mira/pull/29)). Ninguna historia se movió a la Entrega 2. La cápsula de
video (MIR-29) se graba sobre el release desplegado, después del tag.

Al verificar el release se encontró que el detalle de un elemento solo se
abría desde el tablero (los elementos en BACKLOG no tenían cómo abrirse) y que
el tablero no permitía crear. Se agregó **MIR-30**
([#35](https://github.com/MiraPdS/mira/pull/35)) antes de etiquetar: crear
desde el tablero y abrir el detalle desde el backlog.

## Cómo ejecutar el sistema

- **Demo desplegada:** [mira-pds.vercel.app](https://mira-pds.vercel.app),
  usuario `ada@mira.dev` / `demo1234` (datos de prueba, credenciales públicas a
  propósito). La primera petición puede tardar hasta un minuto si la API estaba
  dormida.
- **Local:** requisitos y pasos en el
  [README](https://github.com/MiraPdS/mira#puesta-en-marcha):

```bash
cp .env.example .env    # completar JWT_SECRET
npm install
npm run db:up
npm run db:migrate -w @mira/api
npm run db:seed
npm run dev             # API en :3000 · Web en :5173
```

## Pruebas

**Qué se probó:** reglas de negocio de cada `service` (unitario), las rutas HTTP
completas contra PostgreSQL real (integración) y las páginas React con la red
simulada por MSW (componente). Estrategia completa en
[Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

**Cómo ejecutarlas:**

```bash
npm test                  # todo, con un reporte de cobertura combinado
npm run test:unit         # sin Docker
npm run test:integration  # requiere npm run db:up
npm run test:coverage     # coverage/index.html
```

**Resultados:**

**794 pruebas en 48 archivos, todas pasan; cobertura de líneas 97,0 %**
(ramas 89,3 %). Tablas por proyecto y por paquete, congeladas desde CI, en
[Evidencias de la Entrega 1](Evidencias-Entrega-1.md).

| Proyecto de Vitest | Nivel | Pruebas |
| --- | --- | --- |
| `shared` | unitario | 107 |
| `api-unit` | unitario | 155 |
| `api-integration` | integración (PostgreSQL real) | 212 |
| `web` | componente (RTL + MSW) | 320 |

La evidencia corresponde al commit
[`1c94e87`](https://github.com/MiraPdS/mira/commit/1c94e87e671b97db77cdf876051d349c8d0dc6ff) del PR de MIR-30
([run de CI 37910246418](https://github.com/MiraPdS/mira/actions/runs/37910246418)). El tag `v1.0-entrega1`
tiene el mismo código: después de ese commit solo cambia la documentación.

## Evidencia

La evidencia se entrega como enlaces revisables, no como capturas. Índice
general en [Evidencias](Proyecto-Evidencias.md).

- **Release y tag:** [`v1.0-entrega1`](https://github.com/MiraPdS/mira/releases/tag/v1.0-entrega1).
- **Pruebas y cobertura:** [Evidencias de la Entrega 1](Evidencias-Entrega-1.md).
- **Tablero y criterios de aceptación:**
  [Jira MIR](https://bolgunn.atlassian.net/jira/software/projects/MIR/boards);
  los mismos criterios, versionados, en el
  [backlog](https://github.com/MiraPdS/mira/blob/develop/docs/backlog.md).
- **Trazabilidad historia → PR → pruebas:**
  [Requisitos y trazabilidad](Proyecto-Requisitos-y-trazabilidad.md).
- **PRs representativos**, uno por épica: [#8](https://github.com/MiraPdS/mira/pull/8) (sesión
  persistente), [#13](https://github.com/MiraPdS/mira/pull/13) (roles y miembros), [#1](https://github.com/MiraPdS/mira/pull/1) (crear
  elemento de trabajo), [#22](https://github.com/MiraPdS/mira/pull/22) (arrastrar y soltar),
  [#29](https://github.com/MiraPdS/mira/pull/29) (historial), [#24](https://github.com/MiraPdS/mira/pull/24) (despliegue).
- **Ambiente desplegado:** [`/api/health`](https://mira-pds.vercel.app/api/health).

## Uso de IA

Resumen de **lo declarado en los PRs** de la entrega; no se completa nada por
suposición. Herramientas y su propósito general en
[Arquitectura y tecnologías](Proyecto-Arquitectura-y-tecnologias.md#herramientas-de-ia).

| Declaración en el PR | PRs | Qué dice |
| --- | --- | --- |
| Sección "Uso de IA" completa | [#3](https://github.com/MiraPdS/mira/pull/3), [#28](https://github.com/MiraPdS/mira/pull/28), [#29](https://github.com/MiraPdS/mira/pull/29) | Claude Code (#3, #29) y Codex (#28) para código y pruebas; en #29 también el plan y una revisión de código. Validado con las suites completas en local, typecheck, lint, build y revisión del diff; en #29 además una prueba de mutación del rollback. |
| Solo el pie "Generated with Claude Code" | #5–#8, #11, #18–#20, #23, #24, #26, #31 | La descripción del PR se generó con Claude Code; no detalla qué parte del código. |
| Sin declaración | #1, #2, #4, #9, #10, #12–#17, #21, #22, #25, #27 | La plantilla de PR permitía borrar la sección si no hubo apoyo sustancial de IA, así que esto **no** implica uso no declarado. |

En todos los casos el código pasó por revisión de otro integrante y por CI
antes de entrar a `develop`. Desde la Entrega 2 la sección "Uso de IA" es
obligatoria en la
[plantilla de PR](https://github.com/MiraPdS/mira/blob/develop/.github/pull_request_template.md): se
completa o se responde `Ninguna`.

## Problemas encontrados y pendientes

Problemas resueltos durante la entrega, con su decisión documentada:

- **Cookies de sesión bloqueadas en Safari e incógnito** con la API en otro
  dominio. Se resolvió sirviendo web y API desde el mismo origen con un rewrite
  de Vercel
  ([D13](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d13--mismo-origen-mediante-rewrite-de-vercel)).
- **Migraciones fallando desde Render** porque la conexión directa de Supabase
  es solo IPv6. Se usa el session pooler
  ([`despliegue.md`](https://github.com/MiraPdS/mira/blob/develop/docs/despliegue.md#variables-de-entorno)).
- **Arrastrar y soltar difícil de automatizar.** Se agregó el menú "Mover a…"
  como camino determinista
  ([D9](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d9--kanban-con-dnd-kit-y-un-camino-alternativo-obligatorio)).

**Defectos corregidos.** No se registraron defectos en Jira: cada uno se
encontró en la revisión o en la integración y se corrigió dentro del PR de su
historia. Desde la Entrega 2 se registran con la plantilla
[Defecto](https://github.com/MiraPdS/mira/blob/develop/.github/ISSUE_TEMPLATE/bug.md). Los que salen del
historial del repositorio (sin contar los ajustes menores pedidos en las
revisiones):

| Item | Defecto | Corrección |
| --- | --- | --- |
| MIR-14 | Con identificadores vacíos en la URL, el detalle quedaba cargando para siempre | [`e8b816a`](https://github.com/MiraPdS/mira/commit/e8b816a) · [#4](https://github.com/MiraPdS/mira/pull/4) |
| MIR-12 | Al cambiar de proyecto o eliminar elementos, el backlog pedía una página que ya no existía | [`16e52b2`](https://github.com/MiraPdS/mira/commit/16e52b2) · [#2](https://github.com/MiraPdS/mira/pull/2) |
| MIR-10 | No se podía cambiar el rol de ningún OWNER; ahora solo se protege al último | [`7215b40`](https://github.com/MiraPdS/mira/commit/7215b40) · [#13](https://github.com/MiraPdS/mira/pull/13) |
| MIR-18 | El tablero no se actualizaba tras crear, editar o eliminar elementos | [`c049afe`](https://github.com/MiraPdS/mira/commit/c049afe) · [#16](https://github.com/MiraPdS/mira/pull/16) |
| MIR-23 | El panel del proyecto mostraba totales viejos tras una mutación | [`8924b9e`](https://github.com/MiraPdS/mira/commit/8924b9e) · [#17](https://github.com/MiraPdS/mira/pull/17) |
| MIR-21 | Comentar un elemento que otro usuario acababa de eliminar daba un error 500 | [`c46508e`](https://github.com/MiraPdS/mira/commit/c46508e) · [#15](https://github.com/MiraPdS/mira/pull/15) |
| MIR-19 | Dos movimientos concurrentes registraban un estado anterior obsoleto | [`79cbd7e`](https://github.com/MiraPdS/mira/commit/79cbd7e) · [#20](https://github.com/MiraPdS/mira/pull/20) |
| MIR-27 | Cada redeploy corría el seed y hacía repetir referencias de elementos | [`06ada8a`](https://github.com/MiraPdS/mira/commit/06ada8a), [`61b0b26`](https://github.com/MiraPdS/mira/commit/61b0b26) · [#24](https://github.com/MiraPdS/mira/pull/24) |
| MIR-11, MIR-12 | Backlog y creación no estaban integrados en la página del proyecto; 403/404 mostraban el error crudo de la API | [`b26482b`](https://github.com/MiraPdS/mira/commit/b26482b), [`7b1a77b`](https://github.com/MiraPdS/mira/commit/7b1a77b) · [#28](https://github.com/MiraPdS/mira/pull/28) |

**Pendientes que pasan a la Entrega 2:**

- Sprints (S-01), diferidos por decisión de alcance.
- Registrar los defectos en Jira y declarar siempre el uso de IA en los PRs.
- La cápsula de video (MIR-29) no es un pendiente de alcance: se graba sobre el
  release desplegado, después del tag.

## Supuestos y dependencias de esta entrega

Aplican todos los de
[Supuestos y dependencias](Proyecto-Supuestos-y-dependencias.md). Los que
definen el alcance de esta entrega:

- **S-01:** Sprints diferidos a la Entrega 2, aunque el enunciado los pide.
- **S-02:** columnas del tablero fijas.
- **S-03:** sin organizaciones ni multi-equipo.
- **S-10:** el ambiente desplegado es una demo con datos de prueba.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->
