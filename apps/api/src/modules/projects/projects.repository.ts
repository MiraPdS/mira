import type { Prisma, Project, ProjectMember, ProjectRole, User } from '@prisma/client';
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

/** Un campo del proyecto que cambio, tal como queda en la bitacora. */
export interface ProjectFieldChange {
  field: 'name' | 'description';
  fromValue: string | null;
  toValue: string | null;
}

export interface ProjectsRepository {
  findById(projectId: string): Promise<Project | null>;

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

  /** Actualiza el proyecto y registra una fila PROJECT_UPDATED por campo cambiado. */
  updateWithActivity(
    projectId: string,
    data: { name?: string; description?: string | null },
    changes: ProjectFieldChange[],
    actorId: string,
  ): Promise<Project>;
}

export function createProjectsRepository(db: Db = prisma): ProjectsRepository {
  return {
    findById: (projectId) =>
      db.project.findUnique({
        where: { id: projectId },
      }),

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

    async updateWithActivity(projectId, data, changes, actorId) {
      const run = async (tx: Db) => {
        const project = await tx.project.update({
          where: { id: projectId },
          data,
        });

        if (changes.length > 0) {
          await tx.activityLog.createMany({
            data: changes.map((change) => ({
              action: 'PROJECT_UPDATED' as const,
              projectId,
              actorId,
              ...change,
            })),
          });
        }

        return project;
      };

      // Igual que addMemberWithActivity: si `db` ya es un cliente
      // transaccional no se puede abrir otra transaccion.
      if (!('$transaction' in db)) return run(db);

      return db.$transaction((tx) => run(tx));
    },
  };
}
