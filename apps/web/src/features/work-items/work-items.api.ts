import type { CreateWorkItemInput, Paginated, WorkItemDto } from '@mira/shared';
import { api } from '@/lib/api-client';

type CreateWorkItemResponse = { item: WorkItemDto };

/** Crea un elemento de trabajo dentro del proyecto indicado. */
export async function createWorkItem(
  projectId: string,
  input: CreateWorkItemInput,
): Promise<WorkItemDto> {
  const { item } = await api.post<CreateWorkItemResponse>(
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
