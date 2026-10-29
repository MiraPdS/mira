import type {
  BoardColumnDto,
  BoardColumnListResponse,
  BoardResponse,
  WorkItemDto,
} from '@mira/shared';
import { api } from '@/lib/api-client';

/** MIR-49: columnas del proyecto en el orden del tablero (por `position`). */
export function sortColumns(columns: readonly BoardColumnDto[]): BoardColumnDto[] {
  return [...columns].sort((a, b) => a.position - b.position);
}

/** Items de las columnas del tablero y las columnas del proyecto, en su orden. */
export async function getBoard(projectId: string): Promise<BoardResponse> {
  const { items, columns } = await api.get<BoardResponse>(
    `/projects/${encodeURIComponent(projectId)}/board`,
  );
  return { items, columns: sortColumns(columns) };
}

/** MIR-49: columnas del proyecto, sin sus elementos (filtro del backlog). */
export async function listBoardColumns(projectId: string): Promise<BoardColumnDto[]> {
  const { columns } = await api.get<BoardColumnListResponse>(
    `/projects/${encodeURIComponent(projectId)}/columns`,
  );
  return sortColumns(columns);
}

/**
 * Mueve un item a otra columna del proyecto (MIR-19, MIR-49) y devuelve el
 * item ya persistido. `null` lo devuelve al backlog.
 */
export async function changeWorkItemColumn(
  projectId: string,
  workItemId: string,
  columnId: string | null,
): Promise<WorkItemDto> {
  const { item } = await api.patch<{ item: WorkItemDto }>(
    `/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}/status`,
    { columnId },
  );
  return item;
}
