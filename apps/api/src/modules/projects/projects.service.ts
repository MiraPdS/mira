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

    /** MIR-23: Resumen estadistico y actividad reciente del proyecto. */
    async getProjectSummary(projectId: string, actorId: string) {
      const actorMembership = await repo.findMember(projectId, actorId);

      // La autorizacion se centraliza en la matriz de permisos compartida.
      if (!can(actorMembership?.role, 'project:view')) {
        throw new ForbiddenError('No perteneces a este proyecto', 'PROJECT_ACCESS_DENIED');
      }

      const summary = await repo.getProjectSummary(projectId);

      return {
        total: summary.total,
        byStatus: summary.byStatus,
        byType: summary.byType,
        byPriority: summary.byPriority,
        recentActivity: summary.recentActivity.map((activity) => ({
          id: activity.id,
          action: activity.action,
          workItemId: activity.workItemId,
          actor: activity.actor,
          field: activity.field,
          fromValue: activity.fromValue,
          toValue: activity.toValue,
          createdAt: activity.createdAt.toISOString(),
        })),
      };
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
