# Plan — MIR-6 · Listar mis proyectos

**Rama:** `feature/MIR-6-listar-proyectos` (desde `origin/develop`, `8523c42`, ya
incluye MIR-4)
**Estimacion:** 3 pts · **Prioridad:** Highest
**Alcance:** full-stack en una sola rama y un solo PR, dos commits:
`feat(api): MIR-6 listar proyectos del usuario` y
`feat(web): MIR-6 pantalla mis proyectos`. Toca `apps/api`, `apps/web` y
`@mira/shared` (un tipo nuevo).

## Criterios de aceptacion

1. Miembro de dos proyectos -> en `/proyectos` veo exactamente esos dos, con mi
   rol en cada uno.
2. Un proyecto del que no soy miembro **no** aparece.
3. Sin proyectos -> estado vacio que invita a crear el primero.

## Conflictos con ramas abiertas

| Rama | Archivos | Conflicto |
| --- | --- | --- |
| MIR-9 | `project.*` (singular) nuevo + linea en `app.ts` | No de archivos. Ojo: crea un modulo paralelo a `projects.*` montado en el mismo `/api/projects`. No es de MIR-6, pero conviene avisar a Diego para que lo fusione en `projects.*`. |
| MIR-11 / MIR-12 | `features/work-items/*` | No |

## Lo que ya existe y se reutiliza

| Pieza | Donde | Uso |
| --- | --- | --- |
| `toProjectDto(project, myRole)` | `projects.service.ts` | mapea cada membresia a DTO |
| `projectSchema` / `ProjectDto` (con `myRole`) | `@mira/shared` | forma de cada item |
| `ROLE_LABELS` | `@mira/shared` `domain.ts` | Propietario / Miembro / Observador |
| `router.use(requireAuth)` | `projects.router.ts` | 401 sin sesion |
| `createUser`, `createProject`, `addMember`, `sessionCookie` | `apps/api/src/test/factories.ts` | setup de integracion |
| `AppLayout` + `RequiereSesion` | MIR-4 | la pagina se anida, no se protege a mano |
| Manejador global de 401 | `lib/query-client.ts` (MIR-4) | sesion perdida -> `/login`, sin caso especial |
| `Pendiente` | `App.tsx` | rutas destino aun no construidas |
| `Button` | `components/ui/button.tsx` | "Reintentar". "Nuevo proyecto" es un `<Link>` con clases Tailwind propias: `Button` no soporta `asChild` ni exporta `buttonVariants` |

## Decisiones tomadas

1. **Contrato:** `GET /api/projects` -> `200 { projects: ProjectDto[] }`.
   Sin paginacion (un usuario participa en pocos proyectos; agregarla luego no
   rompe clientes). Orden por `name` ascendente. 401 sin sesion.
2. **Filtro en la base:** una sola consulta sobre `projectMember` con
   `where: { userId }`, `include: { project: true }`,
   `orderBy: { project: { name: 'asc' } }`. CA2 se cumple por construccion.
3. **Tipo compartido `ListProjectsResponse`** en `@mira/shared` para que
   controlador, `projects.api.ts` y el handler de MSW compartan la forma; si
   alguien la cambia en un lado, `typecheck` falla en los otros. Mitiga la
   deriva contrato/mock mientras no haya E2E.
4. **CTA del estado vacio y boton del encabezado** -> `/proyectos/nuevo`,
   registrada como `<Pendiente item="MIR-5" titulo="Nuevo proyecto" />` dentro
   del layout. El boton "Nuevo proyecto" del encabezado de la pagina se ve
   siempre (cargando, error, con datos, vacio). El formulario web de crear
   proyecto **no** entra en MIR-6.
5. **Cada item** es un `<li>` dentro de un `<ul>` (tarjeta simple con Tailwind,
   sin componente `Card` nuevo):
   - nombre como enlace a `/proyectos/:projectId` (por `id`, no por `key`: la
     API ya trabaja por id y MIR-7 puede cambiar la clave);
   - clave en monoespaciada;
   - insignia de rol con `ROLE_LABELS[myRole]`;
   - descripcion recortada a 2 lineas (`line-clamp-2`) si existe.
   Sin fechas ni conteos.
6. **Destino del enlace:** `/proyectos/:projectId` ->
   `<Pendiente item="MIR-23" titulo="Proyecto" />` dentro del layout. No se
   enruta aqui el backlog de MIR-12 (lo hace Isaias).
7. **Estados de la pagina:**
   - cargando -> "Cargando proyectos..." (`role="status"`);
   - error (red/5xx) -> `role="alert"` "No se pudieron cargar tus proyectos." +
     boton "Reintentar" que llama a `refetch()`;
   - 401 -> lo resuelve el manejador global de MIR-4;
   - `<h1>Mis proyectos</h1>` siempre (mantiene verde `App.test.tsx`).
8. **Query key:** `projectKeys.all = ['projects']`, exportada desde
   `useProjects.ts`. Es la misma que siembra el test de logout de MIR-4 y la
   que invalidara el futuro formulario de crear proyecto.
9. **Sin E2E por ahora.** No hay infraestructura (Playwright/CI) y la
   estrategia lo agenda para la Entrega 3. Este flujo queda anotado como
   candidato (ver Cierre).
10. Textos sin tildes, como el resto de la UI.

## Cambios por archivo

### Commit 1 — API

#### 1. `packages/shared/src/schemas/project.ts`

- `export const listProjectsResponseSchema = z.object({ projects: z.array(projectSchema) });`
- `export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;`
- Ya se reexporta via `index.ts`; no hay que tocarlo.

#### 2. `apps/api/src/modules/projects/projects.repository.ts`

- Agregar a la interfaz:
  `listMembershipsOf(userId: string): Promise<Array<{ role: ProjectRole; project: Project }>>`
  (con el comentario de una linea, como los demas metodos).
- Implementacion (decision 2):
  `db.projectMember.findMany({ where: { userId }, include: { project: true }, orderBy: { project: { name: 'asc' } } })`.

#### 3. `apps/api/src/modules/projects/projects.service.ts`

- `async listForUser(userId: string): Promise<ProjectDto[]>` ->
  `(await repo.listMembershipsOf(userId)).map((m) => toProjectDto(m.project, m.role))`.

#### 4. `apps/api/src/modules/projects/projects.controller.ts`

- `async list(req, res, next)`: mismo patron que `create`
  (`if (!req.user) throw new UnauthorizedError()`), responde
  `res.json({ projects } satisfies ListProjectsResponse)`.

#### 5. `apps/api/src/modules/projects/projects.router.ts`

- `router.get('/', controller.list);`

### Commit 2 — Web

#### 6. `apps/web/src/features/projects/projects.api.ts` (nuevo)

- `export async function listProjects(): Promise<ProjectDto[]>` ->
  `const { projects } = await api.get<ListProjectsResponse>('/projects'); return projects;`

#### 7. `apps/web/src/features/projects/useProjects.ts` (nuevo)

- `export const projectKeys = { all: ['projects'] as const };`
- `export function useProjects()` -> `useQuery<ProjectDto[], ApiRequestError>({ queryKey: projectKeys.all, queryFn: listProjects })`.

#### 8. `apps/web/src/features/projects/ProjectsPage.tsx` (nuevo)

- `<main>` con encabezado: `<h1>Mis proyectos</h1>` + enlace-boton
  "Nuevo proyecto" -> `/proyectos/nuevo` (decision 4).
- Debajo, segun `useProjects()` (orden de chequeo: `isPending` -> `isError` ->
  vacio -> lista):
  - estados de la decision 7;
  - vacio: texto "Aun no participas en ningun proyecto." + enlace
    "Crea tu primer proyecto" -> `/proyectos/nuevo`;
  - lista: decision 5.
- Si crece, extraer `ProjectCard` al mismo directorio; no es obligatorio.

#### 9. `apps/web/src/App.tsx`

- `/proyectos` -> `<ProjectsPage />` (se elimina el `Pendiente` de MIR-6).
- Nuevas rutas hijas del layout autenticado, **`/proyectos/nuevo` antes de
  `/proyectos/:projectId`** por legibilidad (React Router v6 ya prioriza el
  segmento estatico, pero el orden explicito evita dudas):
  - `/proyectos/nuevo` -> `<Pendiente item="MIR-5" titulo="Nuevo proyecto" />`
  - `/proyectos/:projectId` -> `<Pendiente item="MIR-23" titulo="Proyecto" />`

#### 10. `apps/web/src/test/msw/handlers.ts`

- Handler por defecto:
  `http.get(\`${BASE_URL}/projects\`, () => HttpResponse.json<ListProjectsResponse>({ projects: [] }))`.
  Sin el, los tests existentes de `App.test.tsx` que visitan `/proyectos` con
  sesion harian una peticion sin handler.
- Opcional: `proyectoDePrueba(overrides)` exportado para construir `ProjectDto`
  en los tests.

## Tests

### API · unitario — `projects.service.test.ts` (ampliar)

`describe('listForUser')`, repositorio doble con `vitest-mock-extended`:

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | Dos membresias (OWNER y VIEWER) | dos DTOs, cada uno con su `myRole`, en el orden que da el repo |
| 2 | Sin membresias | `[]` |

### API · integracion — `projects.integration.test.ts` (ampliar)

`describe('GET /api/projects')`:

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA1 · OWNER de A y VIEWER de B (via `addMember`) | 200, exactamente A y B, `myRole` correcto en cada uno |
| 2 | CA2 · existe C de otro usuario | C no aparece |
| 3 | Usuario sin proyectos | 200 `{ projects: [] }` |
| 4 | Orden | "Gamma", "Alfa", "Beta" creados en ese orden -> vuelven Alfa, Beta, Gamma (misma capitalizacion para no depender del collation de Postgres) |
| 5 | Sin cookie | 401 |

### Web · componente — `features/projects/ProjectsPage.test.tsx` (nuevo)

RTL + MSW, proveedores reales, envuelto en `MemoryRouter` (via
`renderConProviders`).

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA1 · dos proyectos | dos `listitem`; cada uno con nombre, clave y etiqueta de rol; el enlace del nombre apunta a `/proyectos/<id>` |
| 2 | CA3 · lista vacia | texto de estado vacio y enlace "Crea tu primer proyecto" con `href="/proyectos/nuevo"` |
| 3 | Cargando | handler con `delay()`; "Cargando proyectos..." visible |
| 4 | Error 500 | alerta "No se pudieron cargar tus proyectos"; se cambia el handler a 200 y "Reintentar" muestra la lista |
| 5 | Encabezado | "Nuevo proyecto" visible con datos, enlazando a `/proyectos/nuevo` |

CA2 es responsabilidad del servidor: se prueba en integracion, no en web.

### `App.test.tsx`

Sin tests nuevos; los existentes ("Mis proyectos" dentro del layout, flujo de
logout) deben seguir en verde gracias al handler por defecto.

## Verificacion

1. `npx vitest run --project web` y las suites unitaria e integracion de la API
   (`npm run db:up` antes) en verde.
2. `npm run lint`, `npm run typecheck`, `npm run format:check` sin errores.
3. Manual: `npm run db:up`, `npm run dev`;
   - usuario recien registrado -> `/proyectos` muestra el estado vacio; el CTA
     y el boton llevan a "Nuevo proyecto (MIR-5)";
   - crear dos proyectos via API (`POST /api/projects`) y agregar al usuario a
     uno ajeno como VIEWER -> la lista muestra los correctos con su rol,
     ordenados por nombre; un tercero ajeno no aparece;
   - clic en un proyecto -> `/proyectos/<id>` con el marcador MIR-23;
   - apagar la API y recargar la lista (con sesion en cache) -> alerta +
     "Reintentar".

## Cierre

- Commits: `feat(api): MIR-6 listar proyectos del usuario` y
  `feat(web): MIR-6 pantalla mis proyectos`.
- Push con `git push -u origin feature/MIR-6-listar-proyectos`; PR hacia
  `develop`.
- Este plan (`docs/plans/`) no se commitea salvo que se decida lo contrario.
- Pendientes a registrar:
  - ticket Jira "Pantalla crear proyecto (web)" para reemplazar el marcador de
    `/proyectos/nuevo`;
  - candidato E2E para la Entrega 3: login -> lista con A y B y sus roles, C
    ausente -> clic navega a `/proyectos/<id>`;
  - avisar a Diego del modulo duplicado `project.*` de MIR-9.
