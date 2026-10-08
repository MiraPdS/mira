import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateWorkItemInput, Paginated, WorkItemDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { createWorkItem, deleteWorkItem, getWorkItem, listWorkItems } from './work-items.api';

export function useDeleteWorkItem(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiRequestError, void>({
    mutationFn: () => deleteWorkItem(projectId, workItemId),
    onSuccess: async () => {
      const detailKey = ['work-item', projectId, workItemId];
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      // No refetch del detalle eliminado mientras su consumidor sigue montado.
      await queryClient.invalidateQueries({
        queryKey: detailKey,
        exact: true,
        refetchType: 'none',
      });
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === 'work-items' && queryKey.includes(projectId),
      });
    },
  });
}

/** Mutacion de creacion desacoplada de rutas, listas y navegacion. */
export function useCreateWorkItem(projectId: string) {
  return useMutation<WorkItemDto, Error, CreateWorkItemInput>({
    mutationFn: (input) => createWorkItem(projectId, input),
  });
}

/** Consulta una pagina estable del backlog, sin filtros ni orden configurable. */
export function useWorkItems(projectId: string, page: number, pageSize: number) {
  return useQuery<Paginated<WorkItemDto>, Error>({
    queryKey: ['work-items', 'backlog', projectId, page, pageSize],
    queryFn: () => listWorkItems(projectId, page, pageSize),
  });
}

/** Consulta reutilizable del detalle, sin acoplarse a rutas o navegacion. */
export function useWorkItem(projectId: string, workItemId: string) {
  return useQuery<WorkItemDto, ApiRequestError>({
    queryKey: ['work-item', projectId, workItemId],
    queryFn: () => getWorkItem(projectId, workItemId),
    enabled: Boolean(projectId && workItemId),
  });
}
