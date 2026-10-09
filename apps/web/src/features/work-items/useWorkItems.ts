import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateWorkItemInput,
  Paginated,
  UpdateWorkItemInput,
  WorkItemDto,
} from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import {
  createWorkItem,
  deleteWorkItem,
  getWorkItem,
  listWorkItems,
  updateWorkItem,
  normalizeWorkItemListFilters,
  type WorkItemListFilters,
} from './work-items.api';
import { boardKeys } from '@/features/board/useBoard';
import { projectKeys } from '@/features/projects/useProjects';

/**
 * Elimina una tarea y actualiza las consultas relacionadas.
 */
export function useDeleteWorkItem(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiRequestError, void>({
    mutationFn: () => deleteWorkItem(projectId, workItemId),

    onSuccess: async () => {
      const detailKey = ['work-item', projectId, workItemId];

      await queryClient.cancelQueries({
        queryKey: detailKey,
        exact: true,
      });

      // No refetch del detalle eliminado mientras su consumidor sigue montado.
      await queryClient.invalidateQueries({
        queryKey: detailKey,
        exact: true,
        refetchType: 'none',
      });

      // Invalidar las paginas del backlog de este proyecto.
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === 'work-items' && queryKey.includes(projectId),
      });

      // MIR-18: Actualizar tablero Kanban.
      await queryClient.invalidateQueries({
        queryKey: boardKeys.project(projectId),
      });

      // MIR-23: Actualizar estadisticas y actividad reciente.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.summary(projectId),
      });
    },
  });
}

export const workItemKeys = {
  detail: (projectId: string, workItemId: string) => ['work-item', projectId, workItemId] as const,

  backlog: (projectId: string) => ['work-items', 'backlog', projectId] as const,
};

/**
 * Mutacion de creacion desacoplada de rutas, listas y navegacion.
 * Un item puede nacer directamente en una columna (p. ej. TODO).
 */
export function useCreateWorkItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkItemDto, Error, CreateWorkItemInput>({
    mutationFn: (input) => createWorkItem(projectId, input),

    onSuccess: () => {
      // MIR-18: Actualizar tablero Kanban.
      void queryClient.invalidateQueries({
        queryKey: boardKeys.project(projectId),
      });

      // MIR-23: Actualizar estadisticas y actividad reciente.
      void queryClient.invalidateQueries({
        queryKey: projectKeys.summary(projectId),
      });
    },
  });
}

/**
 * Clave canonica: filtros distintos no comparten cache
 * y el mismo filtro si.
 */
export function workItemsQueryKey(
  projectId: string,
  page: number,
  pageSize: number,
  filters: WorkItemListFilters = {},
) {
  return [
    'work-items',
    'backlog',
    projectId,
    page,
    pageSize,
    normalizeWorkItemListFilters(filters),
  ] as const;
}

/**
 * MIR-13: Consulta una pagina estable del backlog con filtros.
 */
export function useWorkItems(
  projectId: string,
  page: number,
  pageSize: number,
  filters: WorkItemListFilters = {},
) {
  return useQuery<Paginated<WorkItemDto>, Error>({
    queryKey: workItemsQueryKey(projectId, page, pageSize, filters),

    queryFn: () => listWorkItems(projectId, page, pageSize, filters),

    // Conservar resultado anterior durante cambios de pagina o filtro.
    placeholderData: keepPreviousData,
  });
}

/**
 * Consulta reutilizable del detalle de una tarea.
 */
export function useWorkItem(projectId: string, workItemId: string) {
  return useQuery<WorkItemDto, ApiRequestError>({
    queryKey: workItemKeys.detail(projectId, workItemId),

    queryFn: () => getWorkItem(projectId, workItemId),

    enabled: Boolean(projectId && workItemId),
  });
}

/**
 * Actualiza el detalle confirmado por el servidor
 * y refresca las consultas afectadas.
 */
export function useUpdateWorkItem(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkItemDto, ApiRequestError, UpdateWorkItemInput>({
    mutationFn: (input) => updateWorkItem(projectId, workItemId, input),

    onSuccess: (item) => {
      // Actualizar detalle con los datos confirmados por el servidor.
      queryClient.setQueryData(workItemKeys.detail(projectId, workItemId), item);

      // MIR-13: Invalidar todas las paginas del backlog del proyecto.
      void queryClient.invalidateQueries({
        queryKey: workItemKeys.backlog(projectId),
      });

      // MIR-18: Actualizar tablero Kanban.
      void queryClient.invalidateQueries({
        queryKey: boardKeys.project(projectId),
      });

      // MIR-23: Actualizar estadisticas y actividad reciente.
      void queryClient.invalidateQueries({
        queryKey: projectKeys.summary(projectId),
      });
    },
  });
}
