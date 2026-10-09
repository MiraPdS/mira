import type {
  CommentDto,
  CreateCommentInput,
  CreateWorkItemInput,
  Paginated,
  UpdateWorkItemInput,
  WorkItemActivityResponse,
  WorkItemDto,
  WorkItemFilters,
} from '@mira/shared';
import { api } from '@/lib/api-client';

type WorkItemResponse = { item: WorkItemDto };
type CommentResponse = { comment: CommentDto };
type CommentsResponse = { comments: CommentDto[] };

/** Filtros opcionales del backlog; la paginacion conserva la firma de MIR-12. */
export type WorkItemListFilters = Pick<
  WorkItemFilters,
  'q' | 'type' | 'status' | 'priority' | 'assigneeId'
>;

/** Normaliza valores vacios para no enviarlos ni distinguirlos en la cache. */
export function normalizeWorkItemListFilters(
  filters: WorkItemListFilters = {},
): WorkItemListFilters {
  const q = filters.q?.trim();

  return {
    ...(q ? { q } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
  };
}

/** Elimina el elemento; el cliente HTTP acepta 204 sin intentar leer JSON. */
export function deleteWorkItem(projectId: string, workItemId: string): Promise<void> {
  return api.delete<void>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}`,
  );
}

/** Crea un elemento de trabajo dentro del proyecto indicado. */
export async function createWorkItem(
  projectId: string,
  input: CreateWorkItemInput,
): Promise<WorkItemDto> {
  const { item } = await api.post<WorkItemResponse>(
    `/projects/${encodeURIComponent(projectId)}/work-items`,
    input,
  );
  return item;
}

/** Obtiene una pagina del backlog de un proyecto. */
export function listWorkItems(
  projectId: string,
  page: number,
  pageSize: number,
  filters: WorkItemListFilters = {},
): Promise<Paginated<WorkItemDto>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const normalizedFilters = normalizeWorkItemListFilters(filters);

  for (const [key, value] of Object.entries(normalizedFilters)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }

  return api.get<Paginated<WorkItemDto>>(
    `/projects/${encodeURIComponent(projectId)}/work-items?${query.toString()}`,
  );
}

/** Obtiene el detalle de un elemento dentro del proyecto indicado. */
export async function getWorkItem(projectId: string, workItemId: string): Promise<WorkItemDto> {
  const { item } = await api.get<WorkItemResponse>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}`,
  );
  return item;
}

/** Actualiza los campos editables de un elemento dentro de su proyecto. */
export async function updateWorkItem(
  projectId: string,
  workItemId: string,
  input: UpdateWorkItemInput,
): Promise<WorkItemDto> {
  const { item } = await api.patch<WorkItemResponse>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}`,
    input,
  );
  return item;
}

/** Obtiene los comentarios de un elemento de trabajo. */
export async function getComments(projectId: string, workItemId: string): Promise<CommentDto[]> {
  const { comments } = await api.get<CommentsResponse>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}/comments`,
  );
  return comments;
}

/** Publica un comentario en un elemento de trabajo. */
export async function createComment(
  projectId: string,
  workItemId: string,
  input: CreateCommentInput,
): Promise<CommentDto> {
  const { comment } = await api.post<CommentResponse>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}/comments`,
    input,
  );
  return comment;
}

/** MIR-22: historial del elemento, del cambio mas reciente al mas antiguo. */
export function getWorkItemActivity(
  projectId: string,
  workItemId: string,
): Promise<WorkItemActivityResponse> {
  return api.get<WorkItemActivityResponse>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}/activity`,
  );
}
