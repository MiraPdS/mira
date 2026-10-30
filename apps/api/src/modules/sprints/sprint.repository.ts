import { Prisma } from '@prisma/client';
import type { CreateSprintInput, ProjectRole, SprintStatus, UpdateSprintInput } from '@mira/shared';
import {
  findMemberRole,
  hasTransaction,
  isSerializationConflict,
  prisma,
  type Db,
} from '../../lib/prisma.js';

export interface SprintRecord {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  committedPoints: number | null;
  completedPoints: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SprintWithMetrics extends SprintRecord {
  items: number;
  points: number;
}

export interface SprintClosingItem {
  id: string;
  estimate: number | null;
  column: { category: string; name: string } | null;
}

export interface CloseSprintData {
  projectId: string;
  sprintId: string;
  actorId: string;
  destinationId: string | null;
  unfinished: SprintClosingItem[];
  committedPoints: number;
  completedPoints: number;
}

/** Puerto inyectable; las transacciones no exponen Prisma al service. */
export interface SprintRepository {
  lockByIdInProject(projectId: string, sprintId: string): Promise<SprintRecord | null>;
  findDestination(sprintId: string): Promise<SprintRecord | null>;
  hasActive(projectId: string): Promise<boolean>;
  start(projectId: string, sprintId: string): Promise<SprintRecord>;
  listClosingItems(projectId: string, sprintId: string): Promise<SprintClosingItem[]>;
  close(data: CloseSprintData): Promise<SprintRecord>;
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
    async lockByIdInProject(projectId, sprintId) {
      // Se coordina con FOR SHARE de MIR-45: ninguna asignacion puede
      // atravesar un cierre confirmado. Serializable reintenta snapshots viejos.
      const [sprint] = await db.$queryRaw<SprintRecord[]>`
        SELECT * FROM sprints WHERE id = ${sprintId} AND "projectId" = ${projectId} FOR UPDATE
      `;
      return sprint ?? null;
    },
    async findDestination(sprintId) {
      const [sprint] = await db.$queryRaw<SprintRecord[]>`
        SELECT * FROM sprints WHERE id = ${sprintId} FOR SHARE
      `;
      return sprint ?? null;
    },
    async hasActive(projectId) {
      // El predicado es parte del snapshot Serializable. Dos inicios de
      // sprints distintos producen un conflicto de escritura/lectura y uno
      // reintenta viendo el ACTIVE que gano; no hay write skew.
      return (
        (await db.sprint.findFirst({
          where: { projectId, status: 'ACTIVE' },
          select: { id: true },
        })) !== null
      );
    },
    start: (projectId, sprintId) =>
      db.sprint.update({
        where: { id: sprintId, projectId },
        data: { status: 'ACTIVE' },
      }),
    listClosingItems: (projectId, sprintId) =>
      db.workItem.findMany({
        where: { projectId, sprintId },
        select: { id: true, estimate: true, column: { select: { category: true, name: true } } },
      }),
    async close(data) {
      const sprint = await db.sprint.update({
        where: { id: data.sprintId, projectId: data.projectId },
        data: {
          status: 'CLOSED',
          committedPoints: data.committedPoints,
          completedPoints: data.completedPoints,
        },
      });
      if (data.unfinished.length > 0) {
        await db.workItem.updateMany({
          where: {
            projectId: data.projectId,
            sprintId: data.sprintId,
            id: { in: data.unfinished.map((item) => item.id) },
          },
          data: {
            sprintId: data.destinationId,
            ...(data.destinationId === null ? { columnId: null } : {}),
          },
        });
        await db.activityLog.createMany({
          data: data.unfinished.flatMap((item) => [
            {
              action: 'ITEM_UPDATED' as const,
              field: 'sprintId',
              projectId: data.projectId,
              actorId: data.actorId,
              workItemId: item.id,
              fromValue: data.sprintId,
              toValue: data.destinationId,
            },
            ...(data.destinationId === null && item.column
              ? [
                  {
                    action: 'ITEM_STATUS_CHANGED' as const,
                    field: 'status',
                    projectId: data.projectId,
                    actorId: data.actorId,
                    workItemId: item.id,
                    fromValue: item.column.name,
                    toValue: 'BACKLOG',
                  },
                ]
              : []),
          ]),
        });
      }
      return sprint;
    },
    async withTransaction(operation) {
      if (!hasTransaction(db)) return operation(createSprintRepository(db));
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await db.$transaction((tx) => operation(createSprintRepository(tx)), {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
        } catch (error) {
          if (attempt >= 2 || !isSerializationConflict(error)) throw error;
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
