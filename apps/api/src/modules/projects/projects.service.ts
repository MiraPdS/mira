import type { Project } from '@prisma/client';
import { can, type CreateProjectInput, type ProjectDto, type ProjectRole } from '@mira/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { ProjectsRepository } from './projects.repository.js';

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
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
