import { Link, useParams } from 'react-router-dom';
import {
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type ActivityAction,
  type ProjectActivityDto,
} from '@mira/shared';
import { useProjectSummary } from './useProjects';

// Descripciones de las acciones registradas en el proyecto.
const actionLabels: Record<ActivityAction, string> = {
  ITEM_CREATED: 'creó un ítem',
  ITEM_UPDATED: 'actualizó un ítem',
  ITEM_STATUS_CHANGED: 'cambió el estado de un ítem',
  ITEM_ASSIGNED: 'asignó un ítem',
  ITEM_DELETED: 'eliminó un ítem',
  COMMENT_ADDED: 'agregó un comentario',
  MEMBER_ADDED: 'agregó un miembro',
  MEMBER_ROLE_CHANGED: 'cambió el rol de un miembro',
  MEMBER_REMOVED: 'eliminó un miembro',
  PROJECT_UPDATED: 'actualizó el proyecto',
};

// Etiquetas de los campos que pueden aparecer en la actividad.
const fieldLabels: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  status: 'Estado',
  type: 'Tipo',
  priority: 'Prioridad',
  estimate: 'Estimación',
  dueDate: 'Fecha límite',
  assigneeId: 'Responsable',
  role: 'Rol',
  member: 'Miembro',
  name: 'Nombre',
  reference: 'Referencia',
};

// Traduce los valores de los enums a sus etiquetas compartidas.
function formatoValor(field: string, value: string | null): string {
  if (value === null) {
    return 'Sin asignar';
  }

  if (field === 'status' && value in STATUS_LABELS) {
    return STATUS_LABELS[value as keyof typeof STATUS_LABELS];
  }

  if (field === 'type' && value in TYPE_LABELS) {
    return TYPE_LABELS[value as keyof typeof TYPE_LABELS];
  }

  if (field === 'priority' && value in PRIORITY_LABELS) {
    return PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS];
  }

  if (field === 'role' && value in ROLE_LABELS) {
    return ROLE_LABELS[value as keyof typeof ROLE_LABELS];
  }

  return value;
}

// Construye una descripcion mas especifica para cada actividad.
function detalleActividad(activity: ProjectActivityDto): string | null {
  const { field, fromValue, toValue, action } = activity;

  if (!field || (fromValue === null && toValue === null)) {
    return null;
  }

  const etiqueta = fieldLabels[field] ?? field;

  // Si existe valor anterior y nuevo, mostramos el cambio.
  if (fromValue !== null && toValue !== null) {
    return `${etiqueta}: ${formatoValor(field, fromValue)} → ${formatoValor(field, toValue)}`;
  }

  // Si se creo o asigno un valor, mostramos el nuevo.
  if (toValue !== null) {
    return `${etiqueta}: ${formatoValor(field, toValue)}`;
  }

  // Para una eliminacion, mostramos el valor que existia.
  if (action === 'ITEM_DELETED') {
    return `${etiqueta}: ${formatoValor(field, fromValue)}`;
  }

  // Un campo que queda sin valor.
  return `${etiqueta}: ${formatoValor(field, fromValue)} → Sin asignar`;
}

// Componente reutilizable para mostrar los conteos.
function SummarySection<K extends string>({
  id,
  title,
  values,
  labels,
}: {
  id: string;
  title: string;
  values: Record<K, number>;
  labels: Record<K, string>;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id={id} className="mb-4 text-lg font-semibold text-slate-900">
        {title}
      </h2>

      <div className="space-y-3">
        {(Object.keys(values) as K[]).map((key) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{labels[key]}</span>

            <span className="font-semibold text-slate-900">{values[key]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProjectSummaryPage() {
  const { projectId } = useParams<{ projectId: string }>();

  // TanStack Query administra la carga, errores y cache del resumen.
  const { data: summary, isPending, isError } = useProjectSummary(projectId ?? '');

  // Proyecto sin identificador.
  if (!projectId) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Resumen del proyecto</h1>

        <p role="alert" className="mt-4 text-red-600">
          No se encontró el identificador del proyecto.
        </p>

        <Link to="/proyectos" className="mt-4 inline-block text-blue-600 hover:underline">
          Volver a proyectos
        </Link>
      </main>
    );
  }

  // Estado de carga.
  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p role="status" className="text-slate-500">
          Cargando resumen del proyecto...
        </p>
      </main>
    );
  }

  // Error al obtener el resumen.
  if (isError || !summary) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Resumen del proyecto</h1>

        <p role="alert" className="mt-4 text-red-600">
          No fue posible cargar el resumen del proyecto.
        </p>

        <Link to="/proyectos" className="mt-4 inline-block text-blue-600 hover:underline">
          Volver a proyectos
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      {/* Encabezado del proyecto */}
      <header>
        <Link to="/proyectos" className="text-sm text-blue-600 hover:underline">
          ← Volver a proyectos
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-900">Resumen del proyecto</h1>

        <p className="mt-2 text-slate-500">Estadísticas y actividad reciente del proyecto.</p>
      </header>

      {/* Total de elementos */}
      <section
        aria-labelledby="resumen-total"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 id="resumen-total" className="text-sm font-medium text-slate-500">
          Total de ítems
        </h2>

        <p className="mt-2 text-4xl font-bold text-slate-900">{summary.total}</p>
      </section>

      {/* Proyecto vacio */}
      {summary.total === 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-semibold text-slate-900">Este proyecto todavía no tiene ítems</h2>

          <p className="mt-2 text-sm text-slate-600">
            Cuando se creen tareas, historias, errores o épicas, podrás consultar sus estadísticas
            aquí.
          </p>
        </section>
      )}

      {/* Estadisticas */}
      <div className="grid gap-5 md:grid-cols-3">
        <SummarySection
          id="resumen-estado"
          title="Por estado"
          values={summary.byStatus}
          labels={STATUS_LABELS}
        />

        <SummarySection
          id="resumen-tipo"
          title="Por tipo"
          values={summary.byType}
          labels={TYPE_LABELS}
        />

        <SummarySection
          id="resumen-prioridad"
          title="Por prioridad"
          values={summary.byPriority}
          labels={PRIORITY_LABELS}
        />
      </div>

      {/* Actividad reciente */}
      <section
        aria-labelledby="resumen-actividad"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 id="resumen-actividad" className="text-xl font-semibold text-slate-900">
          Actividad reciente
        </h2>

        {summary.recentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Todavía no hay actividad registrada en este proyecto.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100">
            {summary.recentActivity.map((activity) => {
              const detalle = detalleActividad(activity);

              return (
                <li key={activity.id} className="py-4">
                  {/* Usuario y accion */}
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{activity.actor.name}</span>{' '}
                    {actionLabels[activity.action]}
                  </p>

                  {/* Informacion especifica del cambio */}
                  {detalle && <p className="mt-1 text-sm break-words text-slate-600">{detalle}</p>}

                  {/* Fecha de la actividad */}
                  <time dateTime={activity.createdAt} className="mt-1 block text-xs text-slate-500">
                    {new Date(activity.createdAt).toLocaleString('es-CL')}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Navegacion hacia el tablero y los miembros */}
      <nav aria-label="Secciones del proyecto" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link
          to={`/proyectos/${projectId}/tablero`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Ver tablero →
        </Link>

        <Link
          to={`/proyectos/${projectId}/miembros`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Ver miembros del proyecto →
        </Link>
      </nav>
    </main>
  );
}
