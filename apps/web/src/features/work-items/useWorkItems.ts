import { useMutation, useQuery } from '@tanstack/react-query';
import type { CreateWorkItemInput, Paginated, WorkItemDto } from '@mira/shared';
import { createWorkItem, listWorkItems } from './work-items.api';

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
