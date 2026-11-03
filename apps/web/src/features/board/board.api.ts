import type {
  BoardColumnDto,
  BoardColumnListResponse,
  BoardColumnResponse,
  BoardResponse,
  CreateBoardColumnInput,
  UpdateBoardColumnInput,
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

/* MIR-50: administrar las columnas (API de MIR-48). */

/** Crea una columna; el servidor la deja al final del tablero. */
export async function createBoardColumn(
  projectId: string,
  input: CreateBoardColumnInput,
): Promise<BoardColumnDto> {
  const { column } = await api.post<BoardColumnResponse>(
    `/projects/${encodeURIComponent(projectId)}/columns`,
    input,
  );
  return column;
}

/** Renombra o cambia la categoria de una columna. */
export async function updateBoardColumn(
  projectId: string,
  columnId: string,
  input: UpdateBoardColumnInput,
): Promise<BoardColumnDto> {
  const { column } = await api.patch<BoardColumnResponse>(
    `/projects/${encodeURIComponent(projectId)}/columns/${encodeURIComponent(columnId)}`,
    input,
  );
  return column;
}

/** Fija el orden completo del tablero y devuelve las columnas ya ordenadas. */
export async function reorderBoardColumns(
  projectId: string,
  columnIds: string[],
): Promise<BoardColumnDto[]> {
  const { columns } = await api.put<BoardColumnListResponse>(
    `/projects/${encodeURIComponent(projectId)}/columns/order`,
    { columnIds },
  );
  return sortColumns(columns);
}

/**
 * Elimina una columna. Si tiene elementos, `moveTo` indica la columna a la que
 * se mueven (sin destino la API responde 409 COLUMN_NOT_EMPTY).
 */
export function deleteBoardColumn(
  projectId: string,
  columnId: string,
  moveTo?: string,
): Promise<void> {
  const query = moveTo ? `?${new URLSearchParams({ moveTo }).toString()}` : '';
  return api.delete<void>(
    `/projects/${encodeURIComponent(projectId)}/columns/${encodeURIComponent(columnId)}${query}`,
  );
}
