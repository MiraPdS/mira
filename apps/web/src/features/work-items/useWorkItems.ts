import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateWorkItemInput,
  Paginated,
  UpdateWorkItemInput,
  WorkItemDto,
} from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { createWorkItem, getWorkItem, listWorkItems, updateWorkItem } from './work-items.api';

export const workItemKeys = {
  detail: (projectId: string, workItemId: string) => ['work-item', projectId, workItemId] as const,
  backlog: (projectId: string) => ['work-items', 'backlog', projectId] as const,
};

/** Mutacion de creacion desacoplada de rutas, listas y navegacion. */
export function useCreateWorkItem(projectId: string) {
  return useMutation<WorkItemDto, Error, CreateWorkItemInput>({
    mutationFn: (input) => createWorkItem(projectId, input),
  });
}

/** Consulta una pagina estable del backlog, sin filtros ni orden configurable. */
export function useWorkItems(projectId: string, page: number, pageSize: number) {
  return useQuery<Paginated<WorkItemDto>, Error>({
    queryKey: [...workItemKeys.backlog(projectId), page, pageSize],
    queryFn: () => listWorkItems(projectId, page, pageSize),
  });
}

/** Consulta reutilizable del detalle, sin acoplarse a rutas o navegacion. */
export function useWorkItem(projectId: string, workItemId: string) {
  return useQuery<WorkItemDto, ApiRequestError>({
    queryKey: workItemKeys.detail(projectId, workItemId),
    queryFn: () => getWorkItem(projectId, workItemId),
    enabled: Boolean(projectId && workItemId),
  });
}

/** Actualiza el detalle confirmado por el servidor y refresca su backlog. */
export function useUpdateWorkItem(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkItemDto, ApiRequestError, UpdateWorkItemInput>({
    mutationFn: (input) => updateWorkItem(projectId, workItemId, input),
    onSuccess: (item) => {
      queryClient.setQueryData(workItemKeys.detail(projectId, workItemId), item);
      // El backlog tiene una query por pagina. El prefijo alcanza todas las
      // paginas del proyecto actualizado, sin invalidar otros proyectos.
      void queryClient.invalidateQueries({ queryKey: workItemKeys.backlog(projectId) });
    },
  });
}
