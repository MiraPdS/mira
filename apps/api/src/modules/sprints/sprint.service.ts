import {
  can,
  type CreateSprintInput,
  type Permission,
  type SprintDto,
  type SprintListItemDto,
  type UpdateSprintInput,
} from '@mira/shared';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { SprintRecord, SprintRepository } from './sprint.repository.js';

export function toSprintDto(sprint: SprintRecord): SprintDto {
  return {
    id: sprint.id,
    projectId: sprint.projectId,
    name: sprint.name,
    goal: sprint.goal,
    startDate: sprint.startDate.toISOString().slice(0, 10),
    endDate: sprint.endDate.toISOString().slice(0, 10),
    status: sprint.status,
    createdAt: sprint.createdAt.toISOString(),
    updatedAt: sprint.updatedAt.toISOString(),
  };
}

function assertDateRange(startDate: string, endDate: string) {
  if (endDate < startDate) {
    throw new ValidationError({
      endDate: ['La fecha de termino no puede ser anterior a la fecha de inicio'],
    });
  }
}

export function createSprintService(repo: SprintRepository) {
  async function assertAccess(
    repository: SprintRepository,
    projectId: string,
    actorId: string,
    permission: Permission,
  ) {
    const role = await repository.findMemberRole(projectId, actorId);
    if (role === null) throw new NotFoundError('Proyecto', 'PROJECT_NOT_FOUND');
    if (!can(role, permission)) throw new ForbiddenError();
  }

  return {
    async create(projectId: string, actorId: string, input: CreateSprintInput): Promise<SprintDto> {
      return repo.withTransaction(async (tx) => {
        await assertAccess(tx, projectId, actorId, 'sprint:create');
        assertDateRange(input.startDate, input.endDate);
        return toSprintDto(await tx.create(projectId, input));
      });
    },

    async list(projectId: string, actorId: string): Promise<SprintListItemDto[]> {
      return repo.withTransaction(async (tx) => {
        await assertAccess(tx, projectId, actorId, 'sprint:view');
        const sprints = await tx.listByProject(projectId);
        return sprints.map((sprint) => ({
          ...toSprintDto(sprint),
          items: sprint.items,
          points: sprint.points,
        }));
      });
    },

    async update(
      projectId: string,
      actorId: string,
      sprintId: string,
      input: UpdateSprintInput,
    ): Promise<SprintDto> {
      return repo.withTransaction(async (tx) => {
        await assertAccess(tx, projectId, actorId, 'sprint:update');
        const current = await tx.findByIdInProject(projectId, sprintId);
        if (!current) throw new NotFoundError('Sprint');
        assertDateRange(
          input.startDate ?? current.startDate.toISOString().slice(0, 10),
          input.endDate ?? current.endDate.toISOString().slice(0, 10),
        );
        return toSprintDto(await tx.update(projectId, sprintId, input));
      });
    },

    async delete(projectId: string, actorId: string, sprintId: string): Promise<void> {
      return repo.withTransaction(async (tx) => {
        await assertAccess(tx, projectId, actorId, 'sprint:delete');
        if (!(await tx.findByIdInProject(projectId, sprintId))) throw new NotFoundError('Sprint');
        await tx.delete(projectId, sprintId);
      });
    },
  };
}

export type SprintService = ReturnType<typeof createSprintService>;
