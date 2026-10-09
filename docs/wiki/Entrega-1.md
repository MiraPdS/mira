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

> ⏳ Se completa en MIR-28: confirmar el alcance final contra el release
> (MIR-17 y MIR-22 siguen abiertos al momento de escribir esto).

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

> ⏳ Se completa en MIR-28: tablas de cobertura y resultados por proyecto
> congeladas con `npm run wiki:evidencias -- entrega-1` sobre el commit del
> release, y enlace al run de CI.

## Evidencia

> ⏳ Se completa en MIR-28: capturas de Jira (tablero y una historia con
> criterios) y de Slack/Discord con la integración; enlaces a PRs
> representativos, al release y al tag `v1.0-entrega1`. Índice general en
> [Evidencias](Proyecto-Evidencias.md).

## Uso de IA

> ⏳ Se completa en MIR-28: resumen de lo declarado en los PRs de la entrega
> (herramienta, qué se generó o modificó, cómo se validó). Herramientas y su
> propósito general en
> [Arquitectura y tecnologías](Proyecto-Arquitectura-y-tecnologias.md#herramientas-de-ia).

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

> ⏳ Se completa en MIR-28: defectos registrados en Jira durante la entrega y
> pendientes que pasan a la Entrega 2.

## Supuestos y dependencias de esta entrega

Aplican todos los de
[Supuestos y dependencias](Proyecto-Supuestos-y-dependencias.md). Los que
definen el alcance de esta entrega:

- **S-01:** Sprints diferidos a la Entrega 2, aunque el enunciado los pide.
- **S-02:** columnas del tablero fijas.
- **S-03:** sin organizaciones ni multi-equipo.
- **S-10:** el ambiente desplegado es una demo con datos de prueba.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->
