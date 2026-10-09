import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddMemberInput, ProjectDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { projectApi } from './project.api';
import type { ProjectMemberRole } from './project.api';
import { boardKeys } from '@/features/board/useBoard';

/**
 * Claves de cache de proyectos. `all` es prefijo de las demas: crear o editar
 * un proyecto invalida `all` y con ella todo lo que cuelga de proyectos.
 */
export const projectKeys = {
  all: ['projects'] as const,
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
};

/** Lista de proyectos del usuario. Un 401 lo resuelve el manejador global. */
export function useProjects() {
  return useQuery<ProjectDto[], ApiRequestError>({
    queryKey: projectKeys.all,
    queryFn: projectApi.list,
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

/**
 * Cambia el rol de un miembro.
 */
export function useChangeMemberRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectMemberRole }) =>
      projectApi.changeMemberRole(projectId, userId, role),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });
    },
  });
}

/**
 * Quita un miembro del proyecto.
 */

/**
 * Quita un miembro del proyecto.
 */
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),

    onSuccess: async () => {
      // Actualizar la lista de miembros.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });

      // Invalidar las paginas del backlog de este proyecto.
      await queryClient.invalidateQueries({
        queryKey: ['work-items', 'backlog', projectId],
      });

      // Invalidar los detalles de tareas de este proyecto.
      await queryClient.invalidateQueries({
        queryKey: ['work-item', projectId],
      });

      // Invalidar el tablero: sus tarjetas muestran al responsable eliminado.
      await queryClient.invalidateQueries({
        queryKey: boardKeys.project(projectId),
      });
    },
  });
}
