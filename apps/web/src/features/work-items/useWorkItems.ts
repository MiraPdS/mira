import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  CommentDto,
  CreateCommentInput,
  CreateWorkItemInput,
  Paginated,
  UpdateWorkItemInput,
  WorkItemDto,
} from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import {
  assignWorkItem,
  createComment,
  createWorkItem,
  deleteWorkItem,
  getComments,
  getWorkItem,
  listWorkItems,
  updateWorkItem,
  normalizeWorkItemListFilters,
  type WorkItemListFilters,
} from './work-items.api';
import { boardKeys } from '@/features/board/useBoard';
import { projectKeys } from '@/features/projects/useProjects';

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
      await queryClient.invalidateQueries({ queryKey: boardKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
      // MIR-21: igual que el detalle, sin refetch de los comentarios del
      // elemento eliminado mientras su consumidor sigue montado (daria 404).
      const commentsKey = commentsQueryKey(projectId, workItemId);
      await queryClient.cancelQueries({ queryKey: commentsKey, exact: true });
      await queryClient.invalidateQueries({
        queryKey: commentsKey,
        exact: true,
        refetchType: 'none',
      });
    },
  });
}
export const workItemKeys = {
  detail: (projectId: string, workItemId: string) => ['work-item', projectId, workItemId] as const,
  backlog: (projectId: string) => ['work-items', 'backlog', projectId] as const,
};

/**
 * Mutacion de creacion desacoplada de rutas, listas y navegacion. Un item puede
 * nacer directamente en una columna (p. ej. TODO), asi que refresca el tablero.
 */
export function useCreateWorkItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkItemDto, Error, CreateWorkItemInput>({
    mutationFn: (input) => createWorkItem(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
    },
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
    queryKey: workItemKeys.detail(projectId, workItemId),
    queryFn: () => getWorkItem(projectId, workItemId),
    enabled: Boolean(projectId && workItemId),
  });
}

/** Actualiza el detalle confirmado por el servidor y refresca su backlog y tablero. */
export function useUpdateWorkItem(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkItemDto, ApiRequestError, UpdateWorkItemInput>({
    mutationFn: (input) => updateWorkItem(projectId, workItemId, input),
    onSuccess: (item) => syncWorkItemCaches(queryClient, projectId, workItemId, item),
  });
}

/**
 * Tras editar o asignar un item, el servidor devuelve el item confirmado: se
 * escribe en el detalle y se refresca todo lo que lo muestra. Un solo lugar
 * para que una vista nueva (p. ej. el historial por elemento de MIR-22) se
 * agregue una vez y alcance a todas las mutaciones del item.
 */
function syncWorkItemCaches(
  queryClient: QueryClient,
  projectId: string,
  workItemId: string,
  item: WorkItemDto,
) {
  queryClient.setQueryData(workItemKeys.detail(projectId, workItemId), item);
  // El backlog tiene una query por pagina. El prefijo alcanza todas las
  // paginas del proyecto actualizado, sin invalidar otros proyectos.
  void queryClient.invalidateQueries({ queryKey: workItemKeys.backlog(projectId) });
  void queryClient.invalidateQueries({ queryKey: boardKeys.project(projectId) });
  void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
}

/**
 * MIR-17: asigna o quita el responsable. Refresca las mismas vistas que editar
 * (backlog con filtro por responsable, tablero y resumen con ITEM_ASSIGNED).
 */
export function useAssignWorkItem(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkItemDto, ApiRequestError, string | null>({
    mutationFn: (assigneeId) => assignWorkItem(projectId, workItemId, assigneeId),
    onSuccess: (item) => syncWorkItemCaches(queryClient, projectId, workItemId, item),
  });
}

/** MIR-21: clave de cache de los comentarios de un elemento. */
export function commentsQueryKey(projectId: string, workItemId: string) {
  return ['work-item-comments', projectId, workItemId] as const;
}

/** MIR-21: comentarios del elemento, del mas antiguo al mas reciente. */
export function useComments(projectId: string, workItemId: string) {
  return useQuery<CommentDto[], ApiRequestError>({
    queryKey: commentsQueryKey(projectId, workItemId),
    queryFn: () => getComments(projectId, workItemId),
    enabled: Boolean(projectId && workItemId),
  });
}

/** MIR-21: publica un comentario y refresca el listado y el resumen (MIR-23). */
export function useCreateComment(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();

  return useMutation<CommentDto, ApiRequestError, CreateCommentInput>({
    mutationFn: (input) => createComment(projectId, workItemId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: commentsQueryKey(projectId, workItemId),
        exact: true,
      });
      // El comentario deja una actividad COMMENT_ADDED en el panel del proyecto.
      void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
    },
  });
}
