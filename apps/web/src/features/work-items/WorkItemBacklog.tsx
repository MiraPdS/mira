import { useEffect, useState } from 'react';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
} from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useWorkItems } from './useWorkItems';
import { normalizeWorkItemListFilters, type WorkItemListFilters } from './work-items.api';

const PAGE_SIZE = 20;

export interface WorkItemBacklogProps {
  projectId: string;
  showTitle?: boolean;
}

/**
 * Backlog reutilizable: su contenedor entrega el proyecto, por lo que este
 * componente no necesita conocer rutas ni el flujo de proyectos.
 */
export function WorkItemBacklog({ projectId, showTitle = true }: WorkItemBacklogProps) {
  const [pagination, setPagination] = useState({ projectId, page: 1 });
  const [filters, setFilters] = useState<WorkItemListFilters>({});
  // Al cambiar de proyecto la pagina anterior no es valida. Derivarla aqui,
  // antes de consultar, evita pedir por error la pagina N del proyecto nuevo.
  const page = pagination.projectId === projectId ? pagination.page : 1;
  const activeFilters = normalizeWorkItemListFilters(filters);
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  const changePage = (update: (currentPage: number) => number) => {
    setPagination((current) => ({
      projectId,
      page: update(current.projectId === projectId ? current.page : 1),
    }));
  };

  const changeFilters = (update: Partial<WorkItemListFilters>) => {
    setFilters((current) => ({ ...current, ...update }));
    setPagination({ projectId, page: 1 });
  };

  const clearFilters = () => {
    setFilters({});
    setPagination({ projectId, page: 1 });
  };

  const backlog = useWorkItems(projectId, page, PAGE_SIZE, filters);
  const members = useProjectMembers(projectId);
  const totalPages = backlog.data ? Math.max(1, Math.ceil(backlog.data.total / PAGE_SIZE)) : 1;

  // Si mientras se navega se eliminan elementos, la pagina solicitada puede
  // dejar de existir. Se vuelve a la ultima valida y se consulta de nuevo.
  useEffect(() => {
    if (backlog.data && page > totalPages) {
      setPagination({ projectId, page: totalPages });
    }
  }, [backlog.data, page, projectId, totalPages]);

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
  if (page > totalPages) {
    return <p role="status">Actualizando backlog...</p>;
  }

  return (
    <section className="w-full rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className={showTitle ? 'text-xl font-semibold text-slate-900' : 'sr-only'}>
        {showTitle ? 'Backlog' : 'Elementos del backlog'}
      </h2>

      <form
        className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="lg:col-span-2">
          <label htmlFor="backlog-search" className="text-sm font-medium text-slate-700">
            Buscar
          </label>
          <Input
            id="backlog-search"
            className="mt-1"
            type="search"
            value={filters.q ?? ''}
            onChange={(event) => changeFilters({ q: event.target.value || undefined })}
            placeholder="Titulo o descripcion"
          />
        </div>

        <div>
          <label htmlFor="backlog-type" className="text-sm font-medium text-slate-700">
            Tipo
          </label>
          <Select
            id="backlog-type"
            value={filters.type ?? ''}
            onChange={(event) =>
              changeFilters({ type: (event.target.value || undefined) as WorkItemType | undefined })
            }
            className="mt-1"
          >
            <option value="">Todos</option>
            {WORK_ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="backlog-status" className="text-sm font-medium text-slate-700">
            Estado
          </label>
          <Select
            id="backlog-status"
            value={filters.status ?? ''}
            onChange={(event) =>
              changeFilters({
                status: (event.target.value || undefined) as WorkItemStatus | undefined,
              })
            }
            className="mt-1"
          >
            <option value="">Todos</option>
            {WORK_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="backlog-priority" className="text-sm font-medium text-slate-700">
            Prioridad
          </label>
          <Select
            id="backlog-priority"
            value={filters.priority ?? ''}
            onChange={(event) =>
              changeFilters({
                priority: (event.target.value || undefined) as WorkItemPriority | undefined,
              })
            }
            className="mt-1"
          >
            <option value="">Todas</option>
            {WORK_ITEM_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="backlog-assignee" className="text-sm font-medium text-slate-700">
            Responsable
          </label>
          <Select
            id="backlog-assignee"
            value={filters.assigneeId ?? ''}
            onChange={(event) => changeFilters({ assigneeId: event.target.value || undefined })}
            disabled={members.isPending || members.isError}
            aria-describedby={members.isError ? 'backlog-members-error' : undefined}
            className="mt-1"
          >
            <option value="">{members.isPending ? 'Cargando miembros...' : 'Todos'}</option>
            {members.data?.members.map((member) => (
              <option key={member.id} value={member.user.id}>
                {member.user.name} ({member.user.email})
              </option>
            ))}
          </Select>
          {members.isError ? (
            <p id="backlog-members-error" role="alert" className="mt-1 text-sm text-red-700">
              {members.error instanceof ApiRequestError
                ? members.error.message
                : 'No se pudo cargar la lista de miembros.'}
            </p>
          ) : null}
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      </form>

      {data.length === 0 && total === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-slate-500">
            {hasActiveFilters ? 'Sin resultados' : 'Aun no hay elementos en este proyecto.'}
          </p>
        </div>
      ) : data.length > 0 ? (
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
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{item.reference}</td>
                  <td className="min-w-48 px-3 py-2">{item.title}</td>
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

      {total > 0 ? (
        <nav
          className="mt-4 flex items-center justify-between gap-3"
          aria-label="Paginacion del backlog"
        >
          <Button
            variant="secondary"
            disabled={page === 1}
            onClick={() => changePage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-600">
            Pagina {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => changePage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Siguiente
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
