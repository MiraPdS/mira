import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { ProjectRepository } from './project.repository.js';

export function createProjectService(repo: ProjectRepository) {
  return {
    /**
     * Obtiene los miembros de un proyecto.
     * Solo los integrantes pueden consultar la lista.
     */
    async getMembers(projectId: string, actorId: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!actorMembership) {
        throw new ForbiddenError('No perteneces a este proyecto', 'PROJECT_ACCESS_DENIED');
      }

      return repo.findMembersByProject(projectId);
    },

    /**
     * MIR-9: Invitar a un miembro al proyecto.
     * Solo el OWNER puede realizar esta accion.
     */
    async addMember(projectId: string, actorId: string, email: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!actorMembership || actorMembership.role !== 'OWNER') {
        throw new ForbiddenError(
          'Solo el OWNER puede agregar miembros al proyecto',
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
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
