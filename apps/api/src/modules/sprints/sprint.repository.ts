import { Prisma } from '@prisma/client';
import type { CreateSprintInput, ProjectRole, SprintStatus, UpdateSprintInput } from '@mira/shared';
import { findMemberRole, hasTransaction, prisma, type Db } from '../../lib/prisma.js';

export interface SprintRecord {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SprintWithMetrics extends SprintRecord {
  items: number;
  points: number;
}

/** Puerto inyectable; las transacciones no exponen Prisma al service. */
export interface SprintRepository {
  withTransaction<T>(operation: (repo: SprintRepository) => Promise<T>): Promise<T>;
  findMemberRole(projectId: string, userId: string): Promise<ProjectRole | null>;
  findByIdInProject(projectId: string, sprintId: string): Promise<SprintRecord | null>;
  create(projectId: string, input: CreateSprintInput): Promise<SprintRecord>;
  listByProject(projectId: string): Promise<SprintWithMetrics[]>;
  update(projectId: string, sprintId: string, input: UpdateSprintInput): Promise<SprintRecord>;
  delete(projectId: string, sprintId: string): Promise<void>;
}

/** Conversion explicita: las fechas del contrato son dias, nunca horas locales. */
const toDatabaseDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

export function createSprintRepository(db: Db = prisma): SprintRepository {
  return {
    async withTransaction(operation) {
      if (!hasTransaction(db)) return operation(createSprintRepository(db));
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await db.$transaction((tx) => operation(createSprintRepository(tx)), {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
        } catch (error) {
          if (
            attempt >= 2 ||
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2034'
          )
            throw error;
        }
      }
    },

    findMemberRole: (projectId, userId) => findMemberRole(db, projectId, userId),

    findByIdInProject: (projectId, sprintId) =>
      db.sprint.findFirst({ where: { id: sprintId, projectId } }),

    create: (projectId, input) =>
      db.sprint.create({
        data: {
          projectId,
          name: input.name,
          goal: input.goal ?? null,
          startDate: toDatabaseDate(input.startDate),
          endDate: toDatabaseDate(input.endDate),
          status: 'PLANNED',
        },
      }),

    async listByProject(projectId) {
      const sprints = await db.sprint.findMany({
        where: { projectId },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      });
      if (sprints.length === 0) return [];

      // Dos consultas para todo el listado, dentro del snapshot del service.
      const groups = await db.workItem.groupBy({
        by: ['sprintId'],
        where: { projectId, sprintId: { in: sprints.map((sprint) => sprint.id) } },
        _count: { _all: true },
        _sum: { estimate: true },
      });
      const metrics = new Map(
        groups.map((group) => [
          group.sprintId,
          {
            items: group._count._all,
            points: group._sum.estimate ?? 0,
          },
        ]),
      );
      return sprints.map((sprint) => ({
        ...sprint,
        ...(metrics.get(sprint.id) ?? { items: 0, points: 0 }),
      }));
    },

    update: (projectId, sprintId, input) =>
      db.sprint.update({
        where: { id: sprintId, projectId },
        data: {
          name: input.name,
          goal: input.goal,
          startDate: input.startDate === undefined ? undefined : toDatabaseDate(input.startDate),
          endDate: input.endDate === undefined ? undefined : toDatabaseDate(input.endDate),
        },
      }),

    async delete(projectId, sprintId) {
      // La FK SET NULL conserva los items y su estado Kanban.
      await db.sprint.delete({ where: { id: sprintId, projectId } });
    },
  };
}
