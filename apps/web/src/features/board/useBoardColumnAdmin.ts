import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { BoardColumnDto, CreateBoardColumnInput, UpdateBoardColumnInput } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { projectKeys } from '@/features/projects/useProjects';
import {
  createBoardColumn,
  deleteBoardColumn,
  reorderBoardColumns,
  sortColumns,
  updateBoardColumn,
} from './board.api';
import { boardKeys } from './useBoard';

/**
 * MIR-50: las columnas se muestran en el tablero, el filtro del backlog, cada
 * elemento (su `column`), el historial y el panel por categoria. Cualquier
 * cambio refresca todo lo que cuelga del proyecto y no de una sola columna.
 */
function refrescarProyecto(queryClient: QueryClient, projectId: string) {
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      // Tablero y su lista de columnas (['board', id, ...]).
      (queryKey[0] === 'board' && queryKey[1] === projectId) ||
      // Backlog paginado (['work-items', 'backlog', id, ...]).
      (queryKey[0] === 'work-items' && queryKey.includes(projectId)) ||
      // Detalle e historial de cada elemento (['work-item', id, itemId]).
      ((queryKey[0] === 'work-item' || queryKey[0] === 'work-item-activity') &&
        queryKey[1] === projectId),
  });
  void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
}

/** Escribe la lista de columnas ya conocida para que la pantalla no espere el refetch. */
function escribirColumnas(
  queryClient: QueryClient,
  projectId: string,
  update: (columns: BoardColumnDto[]) => BoardColumnDto[],
) {
  queryClient.setQueryData<BoardColumnDto[]>(boardKeys.columns(projectId), (columns) =>
    columns ? sortColumns(update(columns)) : columns,
  );
}

/** Agrega una columna al final del tablero (solo OWNER). */
export function useCreateBoardColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<BoardColumnDto, ApiRequestError, CreateBoardColumnInput>({
    mutationFn: (input) => createBoardColumn(projectId, input),
    onSuccess: (column) => {
      escribirColumnas(queryClient, projectId, (columns) => [...columns, column]);
      refrescarProyecto(queryClient, projectId);
    },
  });
}

/** Renombra o cambia la categoria de una columna. */
export function useUpdateBoardColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    BoardColumnDto,
    ApiRequestError,
    { columnId: string; input: UpdateBoardColumnInput }
  >({
    mutationFn: ({ columnId, input }) => updateBoardColumn(projectId, columnId, input),
    onSuccess: (column) => {
      escribirColumnas(queryClient, projectId, (columns) =>
        columns.map((current) => (current.id === column.id ? column : current)),
      );
      refrescarProyecto(queryClient, projectId);
    },
  });
}

/** Cambia el orden completo de las columnas. */
export function useReorderBoardColumns(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<BoardColumnDto[], ApiRequestError, string[]>({
    mutationFn: (columnIds) => reorderBoardColumns(projectId, columnIds),
    onSuccess: (columns) => {
      escribirColumnas(queryClient, projectId, () => columns);
      refrescarProyecto(queryClient, projectId);
    },
    // 409 COLUMN_ORDER_MISMATCH: otra persona cambio las columnas; se recargan.
    onError: (error) => {
      if (error.status === 409) refrescarProyecto(queryClient, projectId);
    },
  });
}

/** Elimina una columna; con elementos, `moveTo` es la columna de destino. */
export function useDeleteBoardColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiRequestError, { columnId: string; moveTo?: string }>({
    mutationFn: ({ columnId, moveTo }) => deleteBoardColumn(projectId, columnId, moveTo),
    onSuccess: (_data, { columnId }) => {
      escribirColumnas(queryClient, projectId, (columns) =>
        columns.filter((column) => column.id !== columnId),
      );
      refrescarProyecto(queryClient, projectId);
    },
  });
}
