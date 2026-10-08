import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CommentDto,
  CreateCommentInput,
  CreateWorkItemInput,
  Paginated,
  WorkItemDto,
} from '@mira/shared';

import type { ApiRequestError } from '@/lib/api-client';

import {
  createComment,
  createWorkItem,
  deleteWorkItem,
  getComments,
  getWorkItem,
  listWorkItems,
  normalizeWorkItemListFilters,
  type WorkItemListFilters,
} from './work-items.api';

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

      await queryClient.invalidateQueries({
        queryKey: detailKey,
        exact: true,
        refetchType: 'none',
      });

      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === 'work-items' && queryKey.includes(projectId),
      });

      // Evita conservar comentarios de un elemento eliminado.
      queryClient.removeQueries({
        queryKey: commentsQueryKey(projectId, workItemId),
        exact: true,
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
    placeholderData: keepPreviousData,
  });
}

/** Consulta reutilizable del detalle. */
export function useWorkItem(projectId: string, workItemId: string) {
  return useQuery<WorkItemDto, ApiRequestError>({
    queryKey: ['work-item', projectId, workItemId],
    queryFn: () => getWorkItem(projectId, workItemId),
    enabled: Boolean(projectId && workItemId),
  });
}

/** Clave de cache de comentarios por proyecto y elemento. */
export function commentsQueryKey(projectId: string, workItemId: string) {
  return ['work-item-comments', projectId, workItemId] as const;
}

/** Consulta los comentarios del elemento en orden cronologico. */
export function useComments(projectId: string, workItemId: string) {
  return useQuery<CommentDto[], ApiRequestError>({
    queryKey: commentsQueryKey(projectId, workItemId),
    queryFn: () => getComments(projectId, workItemId),
    enabled: Boolean(projectId && workItemId),
  });
}

/** Publica un comentario y actualiza el listado despues de crearlo. */
export function useCreateComment(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<CommentDto, ApiRequestError, CreateCommentInput>({
    mutationFn: (input) => createComment(projectId, workItemId, input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: commentsQueryKey(projectId, workItemId),
        exact: true,
      });
    },
  });
}
