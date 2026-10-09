import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberInput,
  CreateProjectInput,
  ProjectDto,
  ProjectSummaryDto,
  UpdateProjectInput,
} from '@mira/shared';
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
  detail: (projectId: string) => ['projects', projectId] as const,
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

/** Crea un proyecto y refresca la lista para que aparezca con su rol. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectDto, ApiRequestError, CreateProjectInput>({
    mutationFn: projectApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/** Un proyecto con el rol del usuario en el (MIR-7). */
export function useProject(projectId: string) {
  return useQuery<ProjectDto, ApiRequestError>({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectApi.get(projectId),
    enabled: Boolean(projectId),
  });
}

/**
 * MIR-23: conteos y actividad reciente del proyecto. Las mutaciones que cambian
 * items o miembros invalidan `projectKeys.summary`.
 */
export function useProjectSummary(projectId: string) {
  return useQuery<ProjectSummaryDto, ApiRequestError>({
    queryKey: projectKeys.summary(projectId),
    queryFn: () => projectApi.getSummary(projectId),
    enabled: Boolean(projectId),
  });
}

/**
 * Edita un proyecto (MIR-7). La respuesta ya es el proyecto actualizado: se
 * escribe en el detalle y se invalida la lista para que muestre el nombre nuevo.
 */
export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProjectDto, ApiRequestError, UpdateProjectInput>({
    mutationFn: (input) => projectApi.update(projectId, input),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.all, exact: true });
      // MIR-23: la edicion deja una actividad PROJECT_UPDATED.
      void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
    },
  });
}

/**
 * MIR-8: elimina el proyecto. Lo quita de la lista al instante y marca como
 * obsoleto todo lo que cuelga de el SIN refetch: la pantalla que lo muestra
 * sigue montada hasta navegar, y volver a pedirlo daria 403.
 */
export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiRequestError, void>({
    mutationFn: () => projectApi.remove(projectId),
    onSuccess: async () => {
      queryClient.setQueryData<ProjectDto[]>(projectKeys.all, (proyectos) =>
        proyectos?.filter((proyecto) => proyecto.id !== projectId),
      );

      const proyecto = projectKeys.detail(projectId);
      await queryClient.cancelQueries({ queryKey: proyecto });
      await queryClient.invalidateQueries({ queryKey: proyecto, refetchType: 'none' });
      await queryClient.invalidateQueries({ queryKey: projectKeys.all, exact: true });
    },
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
      // MIR-23: la actividad reciente registra el cambio de equipo.
      void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
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
      // MIR-23: la actividad reciente registra el cambio de equipo.
      void queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
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

      // MIR-23: la actividad reciente registra la salida del miembro.
      await queryClient.invalidateQueries({ queryKey: projectKeys.summary(projectId) });
    },
  });
}
