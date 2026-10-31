import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CloseSprintInput,
  CreateSprintInput,
  SprintDto,
  SprintListItemDto,
  SprintStatus,
  UpdateSprintInput,
} from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { sprintsApi } from './sprints.api';

/**
 * Claves de cache de sprints. El id del proyecto va en la 2a posicion para que
 * la limpieza de useDeleteProject (MIR-8) tambien alcance a esta lista.
 */
export const sprintKeys = {
  list: (projectId: string) => ['sprints', projectId] as const,
};

/** Orden de la pantalla (MIR-44): el activo arriba, luego planificados y al final cerrados. */
const STATUS_ORDER: Record<SprintStatus, number> = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 };

/**
 * Ordena por estado y, dentro de cada estado, por fecha de inicio (el mismo
 * criterio de la API). Se hace en el cliente para que un sprint recien creado
 * o editado quede en su lugar antes de que llegue el refetch.
 */
export function sortSprints<T extends Pick<SprintDto, 'id' | 'status' | 'startDate'>>(
  sprints: readonly T[],
): T[] {
  return [...sprints].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.startDate.localeCompare(b.startDate) ||
      a.id.localeCompare(b.id),
  );
}

/** Sprints del proyecto, ya ordenados para la pantalla. */
export function useSprints(projectId: string) {
  return useQuery<SprintListItemDto[], ApiRequestError>({
    queryKey: sprintKeys.list(projectId),
    queryFn: () => sprintsApi.list(projectId),
    enabled: Boolean(projectId),
    select: sortSprints,
  });
}

/**
 * Crea un sprint y lo agrega a la lista sin recargar. Un sprint nuevo no tiene
 * items; el refetch posterior confirma las metricas con el servidor.
 */
export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<SprintDto, ApiRequestError, CreateSprintInput>({
    mutationFn: (input) => sprintsApi.create(projectId, input),
    onSuccess: (sprint) => {
      queryClient.setQueryData<SprintListItemDto[]>(sprintKeys.list(projectId), (sprints) =>
        sprints ? [...sprints, { ...sprint, items: 0, points: 0 }] : sprints,
      );
      void queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
    },
  });
}

/** Edita un sprint y reemplaza su fila conservando sus metricas. */
export function useUpdateSprint(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();

  return useMutation<SprintDto, ApiRequestError, UpdateSprintInput>({
    mutationFn: (input) => sprintsApi.update(projectId, sprintId, input),
    onSuccess: (sprint) => {
      queryClient.setQueryData<SprintListItemDto[]>(sprintKeys.list(projectId), (sprints) =>
        sprints?.map((current) => (current.id === sprint.id ? { ...current, ...sprint } : current)),
      );
      void queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
    },
  });
}

/** MIR-46: cancela respuestas previas al cambio antes de refrescar las vistas. */
function useLifecycleRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return async () => {
    const filters = {
      predicate: ({ queryKey }: { queryKey: readonly unknown[] }) =>
        (queryKey[0] === 'work-items' && queryKey[2] === projectId) ||
        (['sprints', 'board', 'projects', 'work-item', 'work-item-activity'].includes(
          String(queryKey[0]),
        ) &&
          queryKey[1] === projectId),
    };
    await queryClient.cancelQueries(filters);
    await queryClient.invalidateQueries(filters);
  };
}

export function useStartSprint(projectId: string, sprintId: string) {
  const refresh = useLifecycleRefresh(projectId);
  return useMutation<SprintDto, ApiRequestError, void>({
    mutationFn: () => sprintsApi.start(projectId, sprintId),
    onSuccess: refresh,
  });
}

export function useCloseSprint(projectId: string, sprintId: string) {
  const refresh = useLifecycleRefresh(projectId);
  return useMutation<SprintDto, ApiRequestError, CloseSprintInput>({
    mutationFn: (input) => sprintsApi.close(projectId, sprintId, input),
    onSuccess: refresh,
  });
}
