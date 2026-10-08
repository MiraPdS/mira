import { useQuery } from '@tanstack/react-query';
import type { ProjectDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { listProjects } from './projects.api';

/** Claves de cache de proyectos. Crear o editar un proyecto invalida `all`. */
export const projectKeys = {
  all: ['projects'] as const,
};

/** Lista de proyectos del usuario. Un 401 lo resuelve el manejador global. */
export function useProjects() {
  return useQuery<ProjectDto[], ApiRequestError>({
    queryKey: projectKeys.all,
    queryFn: listProjects,
  });
}
