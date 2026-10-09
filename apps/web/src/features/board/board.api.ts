import type { BoardResponse, WorkItemDto } from '@mira/shared';
import { api } from '@/lib/api-client';

/** Obtiene todos los items de las columnas del tablero de un proyecto. */
export async function getBoard(projectId: string): Promise<WorkItemDto[]> {
  const { items } = await api.get<BoardResponse>(
    `/projects/${encodeURIComponent(projectId)}/board`,
  );
  return items;
}
