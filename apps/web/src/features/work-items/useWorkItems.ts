import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { CreateWorkItemInput, Paginated, WorkItemDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import {
  createWorkItem,
  getWorkItem,
  listWorkItems,
  normalizeWorkItemListFilters,
  type WorkItemListFilters,
} from './work-items.api';

/** Mutacion de creacion desacoplada de rutas, listas y navegacion. */
export function useCreateWorkItem(projectId: string) {
  return useMutation<WorkItemDto, Error, CreateWorkItemInput>({
    mutationFn: (input) => createWorkItem(projectId, input),
  });
}

/** Clave canonica: filtros distintos no comparten cache y el mismo filtro si. */
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

/** Consulta una pagina estable del backlog, con los filtros de MIR-13. */
export function useWorkItems(
  projectId: string,
  page: number,
  pageSize: number,
  filters: WorkItemListFilters = {},
) {
  return useQuery<Paginated<WorkItemDto>, Error>({
    queryKey: workItemsQueryKey(projectId, page, pageSize, filters),
    queryFn: () => listWorkItems(projectId, page, pageSize, filters),
    // Un cambio de pagina o filtro no debe desmontar los controles mientras
    // llega la nueva respuesta; conserva el resultado anterior durante el refetch.
    placeholderData: keepPreviousData,
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
