import type {
  CreateWorkItemInput,
  Paginated,
  UpdateWorkItemInput,
  WorkItemDto,
} from '@mira/shared';
import { api } from '@/lib/api-client';

type WorkItemResponse = { item: WorkItemDto };

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
): Promise<Paginated<WorkItemDto>> {
  return api.get<Paginated<WorkItemDto>>(
    `/projects/${encodeURIComponent(projectId)}/work-items?page=${page}&pageSize=${pageSize}`,
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
