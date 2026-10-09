import type { Project } from '@prisma/client';
import {
  can,
  type CreateProjectInput,
  type ProjectDto,
  type ProjectRole,
  type UpdateProjectInput,
} from '@mira/shared';
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

export function createProjectsService(repo: ProjectsRepository) {
  return {
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

    /** Proyectos donde el usuario es miembro, cada uno con SU rol. */
    async listForUser(userId: string): Promise<ProjectDto[]> {
      const memberships = await repo.listMembershipsOf(userId);
      return memberships.map((m) => toProjectDto(m.project, m.role));
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

      const actual = await repo.findById(projectId);
      if (!actual) throw new NotFoundError('Proyecto', 'PROJECT_NOT_FOUND');

      const changes: ProjectFieldChange[] = [];
      for (const field of ['name', 'description'] as const) {
        const toValue = input[field];
        if (toValue !== undefined && toValue !== actual[field]) {
          changes.push({ field, fromValue: actual[field], toValue });
        }
      }

      const project = await repo.updateWithActivity(projectId, input, changes, actorId);

      return toProjectDto(project, 'OWNER');
    },

    async getMembers(projectId: string, actorId: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      if (!actorMembership) {
        throw new ForbiddenError('No perteneces a este proyecto', 'PROJECT_ACCESS_DENIED');
      }

      return repo.findMembersByProject(projectId);
    },

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
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
