import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddMemberInput, ProjectDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { projectApi, type ProjectSummary } from './project.api';

/**
 * Claves de cache de proyectos. `all` es prefijo de las demas: crear o editar
 * un proyecto invalida `all` y con ella todo lo que cuelga de proyectos.
 */
export const projectKeys = {
  all: ['projects'] as const,
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
  summary: (projectId: string) => ['projects', projectId, 'summary'] as const,
};

/** Lista de proyectos del usuario. Un 401 lo resuelve el manejador global. */
export function useProjects() {
  return useQuery<ProjectDto[], ApiRequestError>({
    queryKey: projectKeys.all,
    queryFn: projectApi.list,
  });
}

/**
 * MIR-23: Obtiene el resumen estadistico y la actividad reciente
 * de un proyecto usando TanStack Query.
 */
export function useProjectSummary(projectId: string) {
  return useQuery<ProjectSummary, ApiRequestError>({
    queryKey: projectKeys.summary(projectId),
    queryFn: () => projectApi.getSummary(projectId),
    enabled: Boolean(projectId),
  });
}

/**
 * Obtiene los integrantes de un proyecto.
 */
export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => projectApi.getMembers(projectId),
    enabled: Boolean(projectId),
  });
}

/**
 * Invita a un miembro y actualiza la lista del equipo.
 */
export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddMemberInput) => projectApi.addMember(projectId, input),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });
    },
  });
}
