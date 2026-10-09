import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberInput,
  CreateProjectInput,
  ProjectDto,
  ProjectSummaryDto,
  UpdateProjectInput,
} from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
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
 * MIR-8: elimina el proyecto, lo quita de la lista al instante y limpia la
 * cache de todo lo que cuelga de el (ver onSuccess).
 */
export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiRequestError, void>({
    // Un 404 significa que ya estaba eliminado (otra pestana u otra sesion):
    // el resultado buscado ya se cumple, asi que se trata como exito.
    mutationFn: async () => {
      try {
        await projectApi.remove(projectId);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return;
        throw error;
      }
    },
    // Nada se espera aqui: la navegacion a /proyectos (en el onSuccess del
    // componente) no debe quedar detras de operaciones de cache.
    onSuccess: () => {
      // La lista se corrige localmente y no se vuelve a pedir: lo unico que
      // cambio en el servidor es que este proyecto ya no esta.
      queryClient.setQueryData<ProjectDto[]>(projectKeys.all, (proyectos) =>
        proyectos?.filter((proyecto) => proyecto.id !== projectId),
      );

      // Todo lo que cuelga del proyecto lleva su id en la 2a o 3a posicion de
      // la clave: detalle, miembros y resumen (['projects', id, ...]), tablero
      // (['board', id]), backlog (['work-items', 'backlog', id, ...]), detalle
      // de items (['work-item', id, ...]) y comentarios
      // (['work-item-comments', id, ...]). La lista (['projects']) no entra.
      const delProyecto = ({ queryKey }: { queryKey: readonly unknown[] }) =>
        queryKey.slice(1, 3).includes(projectId);

      // Lo que no se esta mostrando se borra, para que volver con el historial
      // no ensene datos de un proyecto que ya no existe. Lo que aun esta en
      // pantalla (la configuracion, hasta navegar) solo se cancela y se marca
      // obsoleto sin refetch: pedirlo de nuevo daria 403/404.
      void queryClient.cancelQueries({ predicate: delProyecto });
      queryClient.removeQueries({
        predicate: (query) => delProyecto(query) && query.getObserversCount() === 0,
      });
      void queryClient.invalidateQueries({ predicate: delProyecto, refetchType: 'none' });
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
