import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { ProjectRepository } from './project.repository.js';

export function createProjectService(repo: ProjectRepository) {
  return {
    async addMember(projectId: string, actorId: string, email: string) {
      // 1. Revisamos que quien está haciendo la invitación
      // pertenezca al proyecto y sea OWNER.
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!actorMembership || actorMembership.role !== 'OWNER') {
        throw new ForbiddenError(
          'Solo el OWNER puede agregar miembros al proyecto',
          'OWNER_REQUIRED',
        );
      }

      // 2. Buscamos al usuario por su correo.
      const user = await repo.findUserByEmail(email);

      if (!user) {
        throw new NotFoundError('Usuario', 'USER_NOT_FOUND');
      }

      // 3. Revisamos que no sea miembro del proyecto actualmente.
      const existingMembership = await repo.findMember(projectId, user.id);

      if (existingMembership) {
        throw new ConflictError('El usuario ya es miembro del proyecto', 'MEMBER_ALREADY_EXISTS');
      }

      // 4. Agregamos al miembro y registramos MEMBER_ADDED.
      return repo.addMemberWithActivity(projectId, user.id, actorId);
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
