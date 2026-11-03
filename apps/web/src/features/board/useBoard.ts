import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BoardColumnDto, BoardResponse, WorkItemDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { projectKeys } from '@/features/projects/useProjects';
import { changeWorkItemColumn, getBoard, listBoardColumns } from './board.api';

/**
 * Clave propia del tablero: MIR-19 y MIR-20 la usan para la actualizacion
 * optimista al mover tarjetas, sin tocar la cache del backlog paginado.
 * Crear, editar o eliminar items y quitar miembros la invalidan.
 */
export const boardKeys = {
  project: (projectId: string) => ['board', projectId] as const,
  move: (projectId: string) => ['board', projectId, 'move'] as const,
  /**
   * MIR-49: solo las columnas (filtro del backlog). Empieza por 'board', asi
   * que invalidar el tablero sin `exact` tambien la refresca.
   */
  columns: (projectId: string) => ['board', projectId, 'columns'] as const,
};

/**
 * Items del tablero y columnas del proyecto en su orden (MIR-49), sin
 * acoplarse a rutas ni navegacion.
 */
export function useBoard(projectId: string) {
  return useQuery<BoardResponse, Error>({
    queryKey: boardKeys.project(projectId),
    queryFn: () => getBoard(projectId),
  });
}

/** MIR-49: columnas del proyecto en su orden, sin cargar los elementos. */
export function useBoardColumns(projectId: string) {
  return useQuery<BoardColumnDto[], Error>({
    queryKey: boardKeys.columns(projectId),
    queryFn: () => listBoardColumns(projectId),
  });
}

export interface MoveWorkItemVariables {
  item: WorkItemDto;
  /** Columna de destino (MIR-49). */
  column: BoardColumnDto;
}

/** Lo que cambia en un item al moverlo: su columna. */
type Ubicacion = Pick<WorkItemDto, 'columnId' | 'column'>;

/**
 * Cambia la columna de una tarjeta con actualizacion optimista.
 *
 * La tarjeta salta de columna antes de que responda la API; si la API falla,
 * vuelve SOLO esa tarjeta a su estado anterior (no se restaura una foto
 * completa del tablero, que pisaria otro movimiento hecho mientras tanto).
 *
 * MIR-20 (arrastrar y soltar) reutiliza esta misma mutacion.
 */
export function useMoveWorkItem(projectId: string) {
  const queryClient = useQueryClient();
  const boardKey = boardKeys.project(projectId);

  const ubicar = (workItemId: string, { columnId, column }: Ubicacion) =>
    queryClient.setQueryData<BoardResponse>(
      boardKey,
      (board) =>
        board && {
          ...board,
          items: board.items.map((item) =>
            item.id === workItemId ? { ...item, columnId, column } : item,
          ),
        },
    );

  return useMutation<WorkItemDto, ApiRequestError, MoveWorkItemVariables, { anterior: Ubicacion }>({
    mutationKey: boardKeys.move(projectId),
    mutationFn: ({ item, column }) => changeWorkItemColumn(projectId, item.id, column.id),

    onMutate: async ({ item, column }) => {
      // Una lectura en vuelo podria llegar despues y deshacer el movimiento.
      await queryClient.cancelQueries({ queryKey: boardKey, exact: true });
      ubicar(item.id, { columnId: column.id, column });
      return { anterior: { columnId: item.columnId, column: item.column } };
    },

    onError: (_error, { item }, context) => {
      if (context) ubicar(item.id, context.anterior);
    },

    // Las invalidaciones NO se esperan: si se devolviera su promesa, la
    // mutacion seguiria pendiente hasta terminar el refresco y el error (o el
    // exito) llegaria tarde a la pantalla.
    onSettled: (_data, _error, { item }) => {
      // Con varios movimientos en vuelo, refrescar al terminar el primero
      // traeria un tablero sin los demas y las tarjetas parpadearian.
      if (queryClient.isMutating({ mutationKey: boardKeys.move(projectId) }) === 1) {
        void queryClient.invalidateQueries({ queryKey: boardKey, exact: true });
      }
      // El backlog y el detalle tambien muestran el estado, y el historial
      // del elemento registra ITEM_STATUS_CHANGED (MIR-22).
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          (queryKey[0] === 'work-items' && queryKey.includes(projectId)) ||
          ((queryKey[0] === 'work-item' || queryKey[0] === 'work-item-activity') &&
            queryKey[1] === projectId &&
            queryKey[2] === item.id),
      });
      // MIR-23: el resumen cuenta por estado y registra ITEM_STATUS_CHANGED.
      void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
    },
  });
}
