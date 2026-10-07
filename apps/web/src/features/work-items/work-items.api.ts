import type { CreateWorkItemInput, WorkItemDto } from '@mira/shared';
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
