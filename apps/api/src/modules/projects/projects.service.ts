import type { Project } from '@prisma/client';
import {
  can,
  PROJECT_ROLES,
  type CreateProjectInput,
  type ProjectDto,
  type ProjectRole,
  type ProjectSummaryDto,
  type UpdateProjectInput,
} from '@mira/shared';
import { toActivityDto } from '../../lib/activity.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { ProjectFieldChange, ProjectsRepository } from './projects.repository.js';

/** Serializa fechas y adjunta el rol del usuario en el proyecto. */
export function toProjectDto(project: Project, myRole: ProjectRole): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    myRole,
  };
}

/**
 * MIR-7: campos que realmente cambian respecto del estado actual. Un campo
 * enviado con el mismo valor no cuenta: un PATCH sin cambios no deja bitacora.
 */
export function diffProject(current: Project, input: UpdateProjectInput): ProjectFieldChange[] {
  const changes: ProjectFieldChange[] = [];
  for (const field of ['name', 'description'] as const) {
    const toValue = input[field];
    if (toValue !== undefined && toValue !== current[field]) {
      changes.push({ field, fromValue: current[field], toValue });
    }
  }
  return changes;
}

export function createProjectsService(repo: ProjectsRepository) {
  return {
    // MIR-5: Crear proyecto.
    async create(input: CreateProjectInput, userId: string): Promise<ProjectDto> {
      const existente = await repo.findByKey(input.key);

      if (existente) {
        throw new ConflictError(
          `Ya existe un proyecto con la clave ${input.key}`,
          'PROJECT_KEY_TAKEN',
        );
      }

      const project = await repo.createWithOwner(
        {
          name: input.name,
          key: input.key,
          description: input.description ?? null,
        },
        userId,
      );

      return toProjectDto(project, 'OWNER');
    },

    // MIR-6: Listar proyectos del usuario.
    async listForUser(userId: string): Promise<ProjectDto[]> {
      const memberships = await repo.listMembershipsOf(userId);

      return memberships.map((membership) => toProjectDto(membership.project, membership.role));
    },

    /** MIR-7: cualquier miembro ve el proyecto con su rol. */
    async getById(projectId: string, actorId: string): Promise<ProjectDto> {
      const membership = await repo.findMember(projectId, actorId);

      // Sin membresia da igual si el proyecto existe: mismo 403 en ambos casos.
      if (!membership || !can(membership.role, 'project:view')) {
        throw new ForbiddenError('No perteneces a este proyecto', 'PROJECT_ACCESS_DENIED');
      }

      const project = await repo.findById(projectId);
      if (!project) throw new NotFoundError('Proyecto', 'PROJECT_NOT_FOUND');

      return toProjectDto(project, membership.role);
    },

    /**
     * MIR-7: el OWNER edita nombre y descripcion. Siempre escribe, pero solo
     * los campos que realmente cambian quedan en la bitacora.
     */
    async update(
      projectId: string,
      actorId: string,
      input: UpdateProjectInput,
    ): Promise<ProjectDto> {
      const membership = await repo.findMember(projectId, actorId);

      if (!can(membership?.role, 'project:update')) {
        throw new ForbiddenError('Solo el propietario puede editar el proyecto', 'OWNER_REQUIRED');
      }

      // El diff se calcula dentro de la transaccion, sobre la fila bloqueada.
      const project = await repo.updateWithActivity(projectId, input, actorId, (current) =>
        diffProject(current, input),
      );
      if (!project) throw new NotFoundError('Proyecto', 'PROJECT_NOT_FOUND');

      return toProjectDto(project, 'OWNER');
    },

    /**
     * MIR-8: solo quien tiene `project:delete` (el OWNER) elimina. El rol se
     * comprueba en el mismo DELETE (ver deleteIfMemberRole), para que un
     * cambio de rol concurrente no deje borrar a quien ya no es OWNER.
     *
     * 404 si el proyecto ya no existe (por ejemplo, un segundo DELETE desde
     * otra pestana); 403 si existe pero quien llama no es su OWNER.
     */
    async delete(projectId: string, actorId: string): Promise<void> {
      const rolesQuePuedenBorrar = PROJECT_ROLES.filter((role) => can(role, 'project:delete'));
      const result = await repo.deleteIfMemberRole(projectId, actorId, rolesQuePuedenBorrar);

      if (result.status === 'not_found') {
        throw new NotFoundError('Proyecto', 'PROJECT_NOT_FOUND');
      }
      if (result.status === 'forbidden') {
        throw new ForbiddenError(
          'Solo el propietario puede eliminar el proyecto',
          'OWNER_REQUIRED',
        );
      }

      // La cascada tambien borra la bitacora del proyecto: queda constancia en
      // el log del servidor de quien elimino que proyecto y cuando.
      console.info(
        '[auditoria] proyecto eliminado',
        JSON.stringify({
          projectId: result.project.id,
          key: result.project.key,
          name: result.project.name,
          actorId,
          at: new Date().toISOString(),
        }),
      );
    },

    // MIR-9: Listar miembros del proyecto.
    async getMembers(projectId: string, actorId: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!actorMembership) {
        throw new ForbiddenError('No perteneces a este proyecto', 'PROJECT_ACCESS_DENIED');
      }

      return repo.findMembersByProject(projectId);
    },

    // MIR-9: Invitar miembros.
    async addMember(projectId: string, actorId: string, email: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!can(actorMembership?.role, 'member:invite')) {
        throw new ForbiddenError(
          'No tienes permisos para agregar miembros al proyecto',
          'OWNER_REQUIRED',
        );
      }

      const user = await repo.findUserByEmail(email);

      if (!user) {
        throw new NotFoundError('Usuario', 'USER_NOT_FOUND');
      }

      const existingMembership = await repo.findMember(projectId, user.id);

      if (existingMembership) {
        throw new ConflictError('El usuario ya es miembro del proyecto', 'MEMBER_ALREADY_EXISTS');
      }

      return repo.addMemberWithActivity(projectId, user.id, actorId);
    },

    // MIR-10: Cambiar rol de un miembro.
    async changeMemberRole(
      projectId: string,
      actorId: string,
      userId: string,
      newRole: ProjectRole,
    ) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!can(actorMembership?.role, 'member:change-role')) {
        throw new ForbiddenError('No tienes permisos para cambiar roles', 'PERMISSION_DENIED');
      }

      // No se permite ascender miembros a OWNER.
      if (newRole === 'OWNER') {
        throw new ForbiddenError('No puedes asignar el rol de propietario', 'OWNER_PROTECTED');
      }

      const targetMembership = await repo.findMember(projectId, userId);

      if (!targetMembership) {
        throw new NotFoundError('Miembro', 'MEMBER_NOT_FOUND');
      }

      // El repositorio verifica dentro de la transaccion
      // que no se degrade al ultimo OWNER.
      return repo.changeMemberRoleWithActivity(projectId, userId, actorId, newRole);
    },

    // MIR-10: Quitar miembro del proyecto.
    async removeMember(projectId: string, actorId: string, userId: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!can(actorMembership?.role, 'member:remove')) {
        throw new ForbiddenError('No tienes permisos para quitar miembros', 'PERMISSION_DENIED');
      }

      const targetMembership = await repo.findMember(projectId, userId);

      if (!targetMembership) {
        throw new NotFoundError('Miembro', 'MEMBER_NOT_FOUND');
      }

      // El repositorio verifica dentro de la transaccion
      // que no se elimine al ultimo OWNER.
      await repo.removeMemberWithActivity(projectId, userId, actorId);
    },

    // MIR-23: Resumen estadistico y actividad reciente del proyecto.
    async getProjectSummary(projectId: string, actorId: string): Promise<ProjectSummaryDto> {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!can(actorMembership?.role, 'project:view')) {
        throw new ForbiddenError('No perteneces a este proyecto', 'PROJECT_ACCESS_DENIED');
      }

      const summary = await repo.getProjectSummary(projectId);

      return {
        ...summary,
        recentActivity: summary.recentActivity.map(toActivityDto),
      };
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
