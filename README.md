# Mira — Gestión de proyectos Scrum y Kanban

Plataforma web para organizar el trabajo de equipos de software: proyectos,
backlog, tablero Kanban, roles y trazabilidad de los cambios.

Proyecto del ramo **INF331 — Pruebas de Software**, Universidad Técnica Federico
Santa María, segundo semestre 2026.

> **Estado:** Entrega 1 en desarrollo. El andamiaje del monorepo y el módulo de
> autenticación están implementados con sus tres niveles de prueba; el resto del
> MVP está en el [backlog](./docs/backlog.md).

## Enlaces

| Recurso | Enlace |
| --- | --- |
| Wiki del proyecto | https://github.com/MiraPdS/mira/wiki |
| Cápsula de video — Entrega 1 | _(pendiente)_ |
| Tablero Jira | https://bolgunn.atlassian.net/jira/software/projects/MIR/boards |
| Release `v1.0-entrega1` | _(pendiente)_ |
| Aplicación desplegada | https://mira-pds.vercel.app |

## Equipo

| Integrante | Área a cargo | GitHub |
| --- | --- | --- |
| Benjamín Olguín | Cuenta, proyectos, infraestructura y entrega | [@nonmeeeeeeeeeeeeeee](https://github.com/nonmeeeeeeeeeeeeeee) |
| Isaías | Elementos de trabajo (CRUD y backlog) | _(completar)_ |
| Mauro Castillo | Tablero Kanban y experiencia de usuario | [@muitomou](https://github.com/muitomou) |
| Diego Espinoza | Equipo, permisos y colaboración |[@diegoosky](https://github.com/diegoosky) |

El reparto detallado de items, el DAG de dependencias y el orden sugerido
están en [`docs/plan-trabajo.md`](./docs/plan-trabajo.md).

## Stack

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| Frontend | React 18 + TypeScript + Vite | Arranque rápido y HMR; Vite comparte configuración con Vitest |
| Estado de servidor | TanStack Query | Caché, reintentos y mutaciones optimistas para el tablero |
| UI | Tailwind CSS 4 + shadcn/ui | Responsive sin diseñador; componentes con roles ARIA correctos, lo que hace consultables los tests de RTL |
| Backend | Node 20 + Express + TypeScript | Módulos por feature con capas internas |
| Base de datos | PostgreSQL 16 (Supabase en el ambiente desplegado) | Relacional, con enums e integridad referencial |
| ORM | Prisma 6 | Esquema declarativo, migraciones versionadas y cliente tipado |
| Validación | Zod, compartido entre front y back | Una sola definición del contrato para runtime y tipos |
| Pruebas | **Vitest + React Testing Library**, Supertest, MSW | Herramienta de testing declarada del equipo |

## Arquitectura

Monorepo con npm workspaces:

```
mira/
├── apps/
│   ├── api/                 API REST (Express + Prisma)
│   │   ├── prisma/          esquema, migraciones y seed
│   │   └── src/
│   │       ├── modules/     un directorio por feature
│   │       ├── middleware/  auth, validación, manejo de errores
│   │       ├── lib/         prisma, jwt, password, errores
│   │       └── test/        resetDb y factories
│   └── web/                 SPA (React + Vite)
│       └── src/
│           ├── features/    un directorio por dominio
│           ├── components/  primitivas de UI (shadcn)
│           ├── lib/         cliente HTTP y query client
│           └── test/        setup, handlers de MSW, helper de render
├── packages/
│   └── shared/              esquemas Zod, tipos y permisos
└── docs/                    backlog, decisiones, estrategia de pruebas y fuente de la Wiki (docs/wiki/)
```

Cada módulo del backend sigue la misma cadena:

```
router → controller → service → repository → Prisma
          (HTTP)      (reglas)   (persistencia)
```

El `service` recibe el repositorio por parámetro y lanza errores de dominio, sin
conocer Express ni Prisma. Por eso se puede probar entero con un doble, en
milisegundos y sin base de datos.

## Puesta en marcha

Requisitos: **Node ≥ 20.11**, **npm ≥ 10** y **Docker Desktop**.

```bash
git clone <url-del-repo>
cd mira

cp .env.example .env
# Genera un JWT_SECRET y pégalo en .env:
#   openssl rand -base64 48

npm install

npm run db:up                      # Postgres dev (5442) y test (5443)
npm run db:migrate -w @mira/api    # aplica las migraciones
npm run db:seed                    # datos de demostración

npm run dev                        # API en :3000 · Web en :5173
```

Usuarios de demostración creados por el seed (misma contraseña `demo1234`):

| Correo | Rol en el proyecto MIR |
| --- | --- |
| `ada@mira.dev` | OWNER |
| `alan@mira.dev` | MEMBER |
| `grace@mira.dev` | VIEWER |

## Pruebas

```bash
npm test                  # todas las suites, un solo reporte
npm run test:unit         # rápido: sin Docker ni base de datos
npm run test:integration  # requiere `npm run db:up`
npm run test:coverage     # genera coverage/ (HTML + lcov)
npm run test:watch        # modo interactivo
```

Tres niveles, cada uno respondiendo una pregunta distinta:

| Nivel | Herramientas | Qué verifica | Dependencias |
| --- | --- | --- | --- |
| **Unitario** | Vitest + `vitest-mock-extended` | Reglas de negocio y matriz de permisos | ninguna |
| **Integración** | Vitest + Supertest + Postgres real | Rutas, códigos de estado, cookies, SQL y restricciones | Docker |
| **Componente** | Vitest + React Testing Library + MSW | Formularios, estados de carga y error, accesibilidad | ninguna |

El detalle está en [`docs/estrategia-pruebas.md`](./docs/estrategia-pruebas.md).

## Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta API y web en paralelo |
| `npm run build` | Compila ambas aplicaciones para producción |
| `npm run lint` / `lint:fix` | ESLint sobre todo el monorepo |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` en los tres workspaces |
| `npm run db:up` / `db:down` | Contenedores de PostgreSQL |
| `npm run db:migrate` | Crea y aplica una migración (desarrollo) |
| `npm run db:reset` | Recrea la base de desarrollo desde cero |
| `npm run db:seed` | Carga los datos de demostración |
| `npm run db:studio -w @mira/api` | Prisma Studio |

## Integración continua

Cada Pull Request ejecuta [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
formato, lint, tipos, las tres suites de pruebas contra un PostgreSQL efímero, y
el build. El reporte de cobertura queda como artefacto del workflow.

En la Entrega 2, Jenkins asume el rol de CI/CD oficial (build, despliegue y
notificaciones a Slack) y este workflow queda como verificación rápida de PR.

## Despliegue

Frontend en Vercel, API en Render y PostgreSQL en Supabase, todo en capa
gratuita y desplegando la rama `main`. Vercel reenvía `/api` a Render, así que
el navegador ve un solo origen ([D13](./docs/decisiones-tecnicas.md)). Cómo
está montado y cómo recrearlo: [`docs/despliegue.md`](./docs/despliegue.md).

- **Credenciales de demostración:** `ada@mira.dev` / `demo1234` (también
  `alan@` y `grace@mira.dev`). Son públicas a propósito: la base solo tiene
  datos de prueba.
- **Primera petición lenta:** si la API llevaba rato sin tráfico, Render la
  despierta en 30-60 s. Un monitor externo la mantiene despierta, pero antes de
  una demo conviene abrir `/api/health`.

## Contribuir

Convenciones de ramas, commits y Pull Requests en
[`CONTRIBUTING.md`](./CONTRIBUTING.md). El reparto del trabajo y su orden, en
[`docs/plan-trabajo.md`](./docs/plan-trabajo.md). Las decisiones técnicas y su
justificación están en [`docs/decisiones-tecnicas.md`](./docs/decisiones-tecnicas.md).

## Licencia

[MIT](./LICENSE).
