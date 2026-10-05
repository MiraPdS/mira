import { useEffect, useState } from 'react';
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api-client';
import { useWorkItems } from './useWorkItems';

const PAGE_SIZE = 20;

export interface WorkItemBacklogProps {
  projectId: string;
}

/**
 * Backlog reutilizable: su contenedor entrega el proyecto, por lo que este
 * componente no necesita conocer rutas ni el flujo de proyectos.
 */
export function WorkItemBacklog({ projectId }: WorkItemBacklogProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [projectId]);

  const backlog = useWorkItems(projectId, page, PAGE_SIZE);

  if (backlog.isPending) {
    return <p role="status">Cargando backlog...</p>;
  }

  if (backlog.isError) {
    const message =
      backlog.error instanceof ApiRequestError
        ? backlog.error.message
        : 'No se pudo cargar el backlog. Intentalo nuevamente.';

    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {message}
      </p>
    );
  }

  const { data, total } = backlog.data;
  if (data.length === 0 && total === 0) {
    return (
      <section className="w-full rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Backlog</h2>
        <p className="mt-2 text-sm text-slate-500">Aun no hay elementos en este proyecto.</p>
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="w-full rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Backlog</h2>

      {data.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Referencia
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Titulo
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Tipo
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Prioridad
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-slate-800">
                  <td className="px-3 py-2 font-medium">{item.reference}</td>
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2">{TYPE_LABELS[item.type]}</td>
                  <td className="px-3 py-2">{STATUS_LABELS[item.status]}</td>
                  <td className="px-3 py-2">{PRIORITY_LABELS[item.priority]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No hay elementos en esta pagina.</p>
      )}

      <nav
        className="mt-4 flex items-center justify-between gap-3"
        aria-label="Paginacion del backlog"
      >
        <Button
          variant="secondary"
          disabled={page === 1}
          onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-slate-600">
          Pagina {page} de {totalPages}
        </span>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
        >
          Siguiente
        </Button>
      </nav>
    </section>
  );
}
