import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddMemberInput } from '@mira/shared';
import { projectApi } from './project.api';
import type { ProjectMemberRole } from './project.api';

export const projectKeys = {
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
};

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
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });
    },
  });
}
