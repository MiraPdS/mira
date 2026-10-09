# Proyecto - Resumen y alcance

## El problema

Los equipos de software necesitan organizar tareas, prioridades, responsables y
avance. Sin una herramienta central, esa información queda repartida entre
planillas, mensajes y reuniones. La salida habitual es pagar un SaaS, con costos
recurrentes, funciones que no se usan y dependencia de un proveedor.

El enunciado ([Tema 2](https://github.com/MiraPdS/mira/blob/develop/requirements/tema2.md))
plantea la pregunta de fondo: **¿por qué pagar permanentemente por una
herramienta que la propia organización puede construir y evolucionar?**

## Objetivo

Construir **Mira**, una plataforma web propia para planificar y seguir el trabajo
de equipos con Scrum y Kanban, y demostrar en el camino que se puede construir
**con pruebas automatizadas como parte del diseño**, no como un agregado final:
es el foco del ramo INF331.

## Usuarios

| Usuario | Qué necesita |
| --- | --- |
| Dueño del proyecto (`OWNER`) | Crear y configurar proyectos, invitar al equipo, asignar roles |
| Integrante (`MEMBER`) | Crear y mover elementos de trabajo, comentar, asignar responsables |
| Observador (`VIEWER`) | Ver el estado del trabajo sin poder modificarlo |

La misma persona puede tener un rol distinto en cada proyecto
([D7](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d7--roles-por-proyecto-y-una-función-can-pura)).

## Alcance de la Entrega 1 (MVP)

| Épica | Qué incluye |
| --- | --- |
| Autenticación | Registro, inicio y cierre de sesión, sesión persistente |
| Proyectos y equipo | CRUD de proyectos, invitar miembros, cambiar roles, quitar miembros |
| Elementos de trabajo | CRUD de historias, tareas, bugs y épicas; backlog paginado; búsqueda y filtros; responsable |
| Tablero Kanban | Tablero por estados, mover por menú y por arrastrar y soltar |
| Colaboración | Comentarios, historial de cambios, panel del proyecto |
| Calidad y entrega | Diseño responsive, `main` protegida con CI, Wiki, despliegue, release y video |

El detalle de cada historia, con sus criterios Dado/Cuando/Entonces, está en
[Requisitos y trazabilidad](Proyecto-Requisitos-y-trazabilidad.md).

## Fuera del alcance de la Entrega 1

El enunciado pide Sprints, pero se difieren conscientemente a la Entrega 2,
junto con otros requerimientos que el modelo de datos ya contempla. Ver
[Supuestos y dependencias](Proyecto-Supuestos-y-dependencias.md) (S-01).

| Reservado | Requerimiento |
| --- | --- |
| MIR-30 | Sprints: crear, asignar elementos, cerrar |
| MIR-31 | Columnas del tablero configurables por proyecto |
| MIR-32 | Organizaciones y multi-equipo |
| MIR-33 | Jenkins como CI/CD, con integración a Slack |

## Principios que guían el diseño

Del enunciado, con lo que significan en este proyecto:

- **Trazabilidad:** cada cambio relevante queda en el historial, dentro de la
  misma transacción que el cambio
  ([D10](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d10--historial-escrito-explícitamente-dentro-de-una-transacción)).
- **Autonomía:** la base es un PostgreSQL estándar y la lógica vive en el
  backend propio, sin atarse al SDK de un proveedor
  ([D2](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d2--supabase-como-postgresql-gestionado-con-prisma-como-orm)).
- **Simplicidad:** las operaciones frecuentes (mover una tarjeta, crear un
  elemento) tienen un camino directo y accesible por teclado.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->
