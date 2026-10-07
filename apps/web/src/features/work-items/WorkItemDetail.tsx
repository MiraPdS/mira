import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { useWorkItem } from './useWorkItems';

export interface WorkItemDetailProps {
  projectId: string;
  workItemId: string;
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function fechaLegible(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

function ElementoNoEncontrado() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Elemento no encontrado</h2>
      <p className="mt-1 text-sm text-slate-500">
        El elemento solicitado no existe o no esta disponible para este proyecto.
      </p>
    </section>
  );
}

/** Muestra el detalle de un elemento sin decidir rutas ni navegacion. */
export function WorkItemDetail({ projectId, workItemId }: WorkItemDetailProps) {
  const { data: item, error, isPending } = useWorkItem(projectId, workItemId);

  // La query se deshabilita con identificadores vacios. En TanStack Query v5
  // eso deja isPending en true, por lo que este caso debe resolverse antes de
  // mostrar el estado de carga.
  if (!projectId || !workItemId) {
    return <ElementoNoEncontrado />;
  }

  if (isPending) {
    return (
      <section role="status" className="p-6 text-sm text-slate-500">
        Cargando elemento...
      </section>
    );
  }

  if (error instanceof ApiRequestError && error.status === 404 && error.code === 'NOT_FOUND') {
    return <ElementoNoEncontrado />;
  }

  if (error || !item) {
    const message =
      error instanceof ApiRequestError ? error.message : 'No se pudo cargar el elemento.';

    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {message}
      </p>
    );
  }

  return (
    <article className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-slate-500">{item.reference}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{item.title}</h2>
      </header>

      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-slate-500">Descripción</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
            {item.description ?? 'Sin descripción'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Tipo</dt>
          <dd className="mt-1 text-sm text-slate-900">{TYPE_LABELS[item.type]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Estado</dt>
          <dd className="mt-1 text-sm text-slate-900">{STATUS_LABELS[item.status]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Prioridad</dt>
          <dd className="mt-1 text-sm text-slate-900">{PRIORITY_LABELS[item.priority]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Responsable</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.assignee?.name ?? 'Sin asignar'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Estimación</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {item.estimate === null
              ? 'Sin estimar'
              : `${item.estimate} ${item.estimate === 1 ? 'punto' : 'puntos'}`}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Fecha límite</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {item.dueDate ? (
              <time dateTime={item.dueDate}>{fechaLegible(item.dueDate)}</time>
            ) : (
              'Sin fecha límite'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Fecha de creación</dt>
          <dd className="mt-1 text-sm text-slate-900">
            <time dateTime={item.createdAt}>{fechaLegible(item.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Última actualización</dt>
          <dd className="mt-1 text-sm text-slate-900">
            <time dateTime={item.updatedAt}>{fechaLegible(item.updatedAt)}</time>
          </dd>
        </div>
      </dl>
    </article>
  );
}
