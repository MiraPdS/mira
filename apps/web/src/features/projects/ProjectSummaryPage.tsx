import { Link, useParams } from 'react-router-dom';
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from '@mira/shared';
import { describeActivity } from '@/features/activity/describeActivity';
import { useProjectSummary } from './useProjects';

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
    <section
      aria-labelledby={id}
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 id={id} className="mb-4 text-lg font-semibold text-slate-900">
        {title}
      </h2>

      <div className="space-y-3">
        {(Object.keys(values) as K[]).map((key) => (
          <div key={key} className="flex items-center justify-between gap-3">
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Resumen del proyecto</h1>

        <p role="alert" className="mt-4 text-red-600">
          No se encontró el identificador del proyecto.
        </p>

        <Link
          to="/proyectos"
          className="mt-4 inline-flex min-h-11 items-center text-blue-600 hover:underline sm:min-h-0"
        >
          Volver a proyectos
        </Link>
      </main>
    );
  }

  // Estado de carga.
  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <p role="status" className="text-slate-500">
          Cargando resumen del proyecto...
        </p>
      </main>
    );
  }

  // Error al obtener el resumen.
  if (isError || !summary) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Resumen del proyecto</h1>

        <p role="alert" className="mt-4 text-red-600">
          No fue posible cargar el resumen del proyecto.
        </p>

        <Link
          to="/proyectos"
          className="mt-4 inline-flex min-h-11 items-center text-blue-600 hover:underline sm:min-h-0"
        >
          Volver a proyectos
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10">
      {/* Encabezado del proyecto */}
      <header>
        <Link
          to="/proyectos"
          className="inline-flex min-h-11 items-center text-sm text-blue-600 hover:underline sm:min-h-0"
        >
          ← Volver a proyectos
        </Link>

        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:mt-4 sm:text-3xl">
          Resumen del proyecto
        </h1>

        <p className="mt-2 text-slate-500">Estadísticas y actividad reciente del proyecto.</p>
      </header>

      {/* Total de elementos */}
      <section
        aria-labelledby="resumen-total"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <h2 id="resumen-total" className="text-sm font-medium text-slate-500">
          Total de ítems
        </h2>

        <p className="mt-2 text-4xl font-bold text-slate-900">{summary.total}</p>
      </section>

      {/* Proyecto vacio */}
      {summary.total === 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
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
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
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
            {summary.recentActivity.map((activity) => (
              <li key={activity.id} className="py-4">
                <p className="text-sm wrap-anywhere text-slate-700">
                  <span className="font-semibold">{activity.actor.name}</span>{' '}
                  {describeActivity(activity, 'project')}
                </p>
                <time dateTime={activity.createdAt} className="mt-1 block text-xs text-slate-500">
                  {new Date(activity.createdAt).toLocaleString('es-CL')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Navegacion hacia el tablero y los miembros */}
      <nav aria-label="Secciones del proyecto" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link
          to={`/proyectos/${projectId}/tablero`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:underline sm:min-h-0"
        >
          Ver tablero →
        </Link>

        <Link
          to={`/proyectos/${projectId}/miembros`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:underline sm:min-h-0"
        >
          Ver miembros del proyecto →
        </Link>
      </nav>
    </main>
  );
}
