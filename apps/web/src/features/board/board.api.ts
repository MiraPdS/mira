import type { BoardResponse, WorkItemDto, WorkItemStatus } from '@mira/shared';
import { api } from '@/lib/api-client';

/** Obtiene todos los items de las columnas del tablero de un proyecto. */
export async function getBoard(projectId: string): Promise<WorkItemDto[]> {
  const { items } = await api.get<BoardResponse>(
    `/projects/${encodeURIComponent(projectId)}/board`,
  );
  return items;
}

/** Mueve un item a otro estado (MIR-19) y devuelve el item ya persistido. */
export async function changeWorkItemStatus(
  projectId: string,
  workItemId: string,
  status: WorkItemStatus,
): Promise<WorkItemDto> {
  const { item } = await api.patch<{ item: WorkItemDto }>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}/status`,
    { status },
  );
  return item;
}
