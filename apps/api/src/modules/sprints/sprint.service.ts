import {
  can,
  type CloseSprintInput,
  type CreateSprintInput,
  type Permission,
  type SprintDto,
  type SprintListItemDto,
  type UpdateSprintInput,
} from '@mira/shared';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
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
    committedPoints: sprint.committedPoints,
    completedPoints: sprint.completedPoints,
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
    async start(projectId: string, actorId: string, sprintId: string): Promise<SprintDto> {
      return repo.withTransaction(async (tx) => {
        await assertAccess(tx, projectId, actorId, 'sprint:update');
        const sprint = await tx.lockByIdInProject(projectId, sprintId);
        if (!sprint) throw new NotFoundError('Sprint');
        if (sprint.status !== 'PLANNED')
          throw new ConflictError(
            'Solo se puede iniciar un sprint planificado',
            'SPRINT_NOT_PLANNED',
          );
        if (await tx.hasActive(projectId))
          throw new ConflictError('El proyecto ya tiene un sprint activo', 'SPRINT_ALREADY_ACTIVE');
        return toSprintDto(await tx.start(projectId, sprintId));
      });
    },
    async close(
      projectId: string,
      actorId: string,
      sprintId: string,
      input: CloseSprintInput,
    ): Promise<SprintDto> {
      return repo.withTransaction(async (tx) => {
        await assertAccess(tx, projectId, actorId, 'sprint:update');
        const sprint = await tx.lockByIdInProject(projectId, sprintId);
        if (!sprint) throw new NotFoundError('Sprint');
        if (sprint.status !== 'ACTIVE')
          throw new ConflictError('Solo se puede cerrar un sprint activo', 'SPRINT_NOT_ACTIVE');
        const destinationId = input.moveUnfinishedToSprintId;
        if (destinationId !== null) {
          if (destinationId === sprintId)
            throw new BadRequestError('El destino debe ser otro sprint', 'SPRINT_DESTINATION_SAME');
          const destination = await tx.findDestination(destinationId);
          if (!destination) throw new NotFoundError('Sprint destino', 'SPRINT_NOT_FOUND');
          if (destination.projectId !== projectId)
            throw new BadRequestError(
              'El sprint destino pertenece a otro proyecto',
              'SPRINT_PROJECT_MISMATCH',
            );
          if (destination.status !== 'PLANNED')
            throw new ConflictError(
              'El destino debe ser un sprint planificado',
              'SPRINT_DESTINATION_NOT_PLANNED',
            );
        }
        const items = await tx.listClosingItems(projectId, sprintId);
        return toSprintDto(
          await tx.close({
            projectId,
            actorId,
            sprintId,
            destinationId,
            committedPoints: items.reduce((sum, item) => sum + (item.estimate ?? 0), 0),
            completedPoints: items.reduce(
              (sum, item) => sum + (item.column?.category === 'DONE' ? (item.estimate ?? 0) : 0),
              0,
            ),
            unfinished: items.filter((item) => item.column?.category !== 'DONE'),
          }),
        );
      });
    },
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
