import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddMemberInput, ProjectDto } from '@mira/shared';
import type { ApiRequestError } from '@/lib/api-client';
import { boardKeys } from '@/features/board/useBoard';
import { projectApi, type ProjectMemberRole, type ProjectSummary } from './project.api';

/**
 * Claves de cache de proyectos.
 * `all` es prefijo de las demas consultas de proyectos.
 */
export const projectKeys = {
  all: ['projects'] as const,
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
  summary: (projectId: string) => ['projects', projectId, 'summary'] as const,
};

/** MIR-6: Lista de proyectos del usuario autenticado. */
export function useProjects() {
  return useQuery<ProjectDto[], ApiRequestError>({
    queryKey: projectKeys.all,
    queryFn: projectApi.list,
  });
}

/**
 * MIR-23: Obtiene el resumen estadistico y la actividad reciente
 * del proyecto mediante TanStack Query.
 */
export function useProjectSummary(projectId: string) {
  return useQuery<ProjectSummary, ApiRequestError>({
    queryKey: projectKeys.summary(projectId),
    queryFn: () => projectApi.getSummary(projectId),
    enabled: Boolean(projectId),
  });
}

/** MIR-9: Obtiene los integrantes del proyecto. */
export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => projectApi.getMembers(projectId),
    enabled: Boolean(projectId),
  });
}

/** MIR-9: Invita a un miembro y actualiza las consultas afectadas. */
export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddMemberInput) => projectApi.addMember(projectId, input),

    onSuccess: async () => {
      // MIR-9: Actualizar listado de miembros.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });

      // MIR-23: Actualizar actividad reciente.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.summary(projectId),
      });
    },
  });
}

/** MIR-10: Cambia el rol de un miembro. */
export function useChangeMemberRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectMemberRole }) =>
      projectApi.changeMemberRole(projectId, userId, role),

    onSuccess: async () => {
      // MIR-10: Actualizar listado de miembros.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });

      // MIR-23: Actualizar actividad reciente.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.summary(projectId),
      });
    },
  });
}

/**
 * MIR-10: Quita un miembro del proyecto.
 * Actualiza las consultas afectadas, incluido el tablero de MIR-18.
 */
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),

    onSuccess: async () => {
      // MIR-10: Actualizar la lista de miembros.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });

      // Invalidar las paginas del backlog de este proyecto.
      await queryClient.invalidateQueries({
        queryKey: ['work-items', 'backlog', projectId],
      });

      // Invalidar los detalles de tareas del proyecto.
      await queryClient.invalidateQueries({
        queryKey: ['work-item', projectId],
      });

      // MIR-18: Invalidar tablero Kanban.
      await queryClient.invalidateQueries({
        queryKey: boardKeys.project(projectId),
      });

      // MIR-23: Actualizar actividad reciente.
      await queryClient.invalidateQueries({
        queryKey: projectKeys.summary(projectId),
      });
    },
  });
}
