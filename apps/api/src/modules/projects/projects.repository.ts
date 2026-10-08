import type {
  ActivityLog,
  Prisma,
  Project,
  ProjectMember,
  ProjectRole,
  User,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

export type ProjectMemberWithUser = Prisma.ProjectMemberGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        createdAt: true;
      };
    };
  };
}>;

export type RecentProjectActivity = ActivityLog & {
  actor: {
    id: string;
    name: string;
  };
};

export interface ProjectSummaryData {
  total: number;
  byStatus: Record<WorkItemStatus, number>;
  byType: Record<WorkItemType, number>;
  byPriority: Record<WorkItemPriority, number>;
  recentActivity: RecentProjectActivity[];
}

export interface ProjectsRepository {
  findByKey(key: string): Promise<Project | null>;

  createWithOwner(
    data: { name: string; key: string; description: string | null },
    ownerId: string,
  ): Promise<Project>;

  /** Membresias del usuario con su proyecto, ordenadas por nombre del proyecto. */
  listMembershipsOf(userId: string): Promise<Array<{ role: ProjectRole; project: Project }>>;

  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;

  findUserByEmail(email: string): Promise<User | null>;

  findMembersByProject(projectId: string): Promise<ProjectMemberWithUser[]>;

  addMemberWithActivity(projectId: string, userId: string, actorId: string): Promise<ProjectMember>;

  /** MIR-23: Estadisticas completas y actividad reciente del proyecto. */
  getProjectSummary(projectId: string): Promise<ProjectSummaryData>;
}

export function createProjectsRepository(db: Db = prisma): ProjectsRepository {
  return {
    findByKey: (key) =>
      db.project.findUnique({
        where: { key },
      }),

    createWithOwner: (data, ownerId) =>
      db.project.create({
        data: {
          ...data,
          members: {
            create: {
              userId: ownerId,
              role: 'OWNER',
            },
          },
        },
      }),

    // Se parte de la membresia, no del proyecto: un proyecto ajeno no puede
    // colarse en la lista porque nunca entra en la consulta.
    listMembershipsOf: (userId) =>
      db.projectMember.findMany({
        where: { userId },
        include: { project: true },
        orderBy: { project: { name: 'asc' } },
      }),

    findMember: (projectId, userId) =>
      db.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      }),

    findUserByEmail: (email) =>
      db.user.findUnique({
        where: { email },
      }),

    findMembersByProject: (projectId) =>
      db.projectMember.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),

    async addMemberWithActivity(projectId, userId, actorId) {
      if (!('$transaction' in db)) {
        const member = await db.projectMember.create({
          data: {
            projectId,
            userId,
            role: 'MEMBER',
          },
        });

        await db.activityLog.create({
          data: {
            action: 'MEMBER_ADDED',
            projectId,
            actorId,
            field: 'member',
            toValue: userId,
          },
        });

        return member;
      }

      return db.$transaction(async (tx) => {
        const member = await tx.projectMember.create({
          data: {
            projectId,
            userId,
            role: 'MEMBER',
          },
        });

        await tx.activityLog.create({
          data: {
            action: 'MEMBER_ADDED',
            projectId,
            actorId,
            field: 'member',
            toValue: userId,
          },
        });

        return member;
      });
    },

    // MIR-23: Los conteos se calculan en la base de datos, sin paginacion.
    async getProjectSummary(projectId) {
      const [statusGroups, typeGroups, priorityGroups, recentActivity] = await Promise.all([
        db.workItem.groupBy({
          by: ['status'],
          where: { projectId },
          _count: { _all: true },
        }),
        db.workItem.groupBy({
          by: ['type'],
          where: { projectId },
          _count: { _all: true },
        }),
        db.workItem.groupBy({
          by: ['priority'],
          where: { projectId },
          _count: { _all: true },
        }),
        db.activityLog.findMany({
          where: { projectId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 10,
          include: {
            actor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      const byStatus: Record<WorkItemStatus, number> = {
        BACKLOG: 0,
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      };

      const byType: Record<WorkItemType, number> = {
        EPIC: 0,
        STORY: 0,
        TASK: 0,
        BUG: 0,
      };

      const byPriority: Record<WorkItemPriority, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };

      for (const group of statusGroups) {
        byStatus[group.status] = group._count._all;
      }

      for (const group of typeGroups) {
        byType[group.type] = group._count._all;
      }

      for (const group of priorityGroups) {
        byPriority[group.priority] = group._count._all;
      }

      return {
        total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
        byStatus,
        byType,
        byPriority,
        recentActivity,
      };
    },
  };
}
