import type { Project } from '@prisma/client';
import type { CreateProjectInput, ProjectDto, ProjectRole } from '@mira/shared';
import { ConflictError } from '../../lib/errors.js';
import type { ProjectsRepository } from './projects.repository.js';

/**
 * Reglas de negocio de proyectos.
 *
 * No conoce Express ni Prisma: recibe el repositorio por parametro y lanza
 * errores de dominio.
 */

/** Serializa fechas y adjunta el rol del usuario en ESTE proyecto. */
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
        // Si dos peticiones pasan este chequeo a la vez, la restriccion unica
        // de la base las frena igual y el errorHandler traduce P2002 a 409.
        throw new ConflictError(
          `Ya existe un proyecto con la clave ${input.key}`,
          'PROJECT_KEY_TAKEN',
        );
      }

      const project = await repo.createWithOwner(
        { name: input.name, key: input.key, description: input.description ?? null },
        userId,
      );

      // Quien crea el proyecto queda como OWNER: lo garantiza createWithOwner.
      return toProjectDto(project, 'OWNER');
    },

    /** Proyectos donde el usuario es miembro, cada uno con SU rol. */
    async listForUser(userId: string): Promise<ProjectDto[]> {
      const memberships = await repo.listMembershipsOf(userId);
      return memberships.map((m) => toProjectDto(m.project, m.role));
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
