import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectApi, type ProjectSummary } from './project.api';

const statusLabels: Record<keyof ProjectSummary['byStatus'], string> = {
  BACKLOG: 'Backlog',
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  DONE: 'Terminado',
};

const typeLabels: Record<keyof ProjectSummary['byType'], string> = {
  EPIC: 'Épica',
  STORY: 'Historia',
  TASK: 'Tarea',
  BUG: 'Error',
};

const priorityLabels: Record<keyof ProjectSummary['byPriority'], string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const actionLabels: Record<string, string> = {
  ITEM_CREATED: 'creó un ítem',
  ITEM_UPDATED: 'actualizó un ítem',
  ITEM_STATUS_CHANGED: 'cambió el estado de un ítem',
  ITEM_ASSIGNED: 'asignó un ítem',
  ITEM_DELETED: 'eliminó un ítem',
  COMMENT_ADDED: 'agregó un comentario',
  MEMBER_ADDED: 'agregó un miembro',
  MEMBER_ROLE_CHANGED: 'cambió el rol de un miembro',
  MEMBER_REMOVED: 'eliminó un miembro',
};

function SummarySection({
  title,
  values,
  labels,
}: {
  title: string;
  values: Record<string, number>;
  labels: Record<string, string>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>

      <div className="space-y-3">
        {Object.entries(values).map(([key, count]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{labels[key] ?? key}</span>
            <span className="font-semibold text-slate-900">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProjectSummaryPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setError('No se encontró el identificador del proyecto.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);
      setSummary(null);

      try {
        const result = await projectApi.getSummary(projectId!);

        if (!cancelled) {
          setSummary(result);
        }
      } catch {
        if (!cancelled) {
          setError('No fue posible cargar el resumen del proyecto.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p role="status" className="text-slate-500">
          Cargando resumen del proyecto...
        </p>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Resumen del proyecto</h1>
        <p role="alert" className="mt-4 text-red-600">
          {error ?? 'No hay información disponible.'}
        </p>
        <Link to="/proyectos" className="mt-4 inline-block text-blue-600 hover:underline">
          Volver a proyectos
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <Link to="/proyectos" className="text-sm text-blue-600 hover:underline">
          ← Volver a proyectos
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-900">Resumen del proyecto</h1>

        <p className="mt-2 text-slate-500">Estadísticas y actividad reciente del proyecto.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium text-slate-500">Total de ítems</h2>
        <p className="mt-2 text-4xl font-bold text-slate-900">{summary.total}</p>
      </section>

      {summary.total === 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-semibold text-slate-900">Este proyecto todavía no tiene ítems</h2>
          <p className="mt-2 text-sm text-slate-600">
            Cuando se creen tareas, historias, errores o épicas, podrás consultar sus estadísticas
            aquí.
          </p>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <SummarySection title="Por estado" values={summary.byStatus} labels={statusLabels} />

        <SummarySection title="Por tipo" values={summary.byType} labels={typeLabels} />

        <SummarySection title="Por prioridad" values={summary.byPriority} labels={priorityLabels} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Actividad reciente</h2>

        {summary.recentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Todavía no hay actividad registrada en este proyecto.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100">
            {summary.recentActivity.map((activity) => (
              <li key={activity.id} className="py-4">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{activity.actor.name}</span>{' '}
                  {actionLabels[activity.action] ?? activity.action}
                </p>

                <time dateTime={activity.createdAt} className="mt-1 block text-xs text-slate-500">
                  {new Date(activity.createdAt).toLocaleString('es-CL')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to={`/proyectos/${projectId}/miembros`}
        className="inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        Ver miembros del proyecto →
      </Link>
    </main>
  );
}
