import { useQuery } from '@tanstack/react-query';
import type { WorkItemDto } from '@mira/shared';
import { getBoard } from './board.api';

/**
 * Clave propia del tablero: MIR-19 y MIR-20 la usaran para la actualizacion
 * optimista al mover tarjetas, sin tocar la cache del backlog paginado.
 * Crear, editar o eliminar items y quitar miembros la invalidan.
 */
export const boardKeys = {
  project: (projectId: string) => ['board', projectId] as const,
};

/** Items del tablero de un proyecto, sin acoplarse a rutas ni navegacion. */
export function useBoard(projectId: string) {
  return useQuery<WorkItemDto[], Error>({
    queryKey: boardKeys.project(projectId),
    queryFn: () => getBoard(projectId),
  });
}
