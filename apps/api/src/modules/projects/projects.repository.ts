import { Prisma as PrismaRuntime } from '@prisma/client';
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
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
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

// MIR-23: Actividad reciente del proyecto.
export type RecentProjectActivity = ActivityLog & {
  actor: {
    id: string;
    name: string;
  };
};

// MIR-23: Datos del resumen estadistico.
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

  /** Membresias del usuario con su proyecto, ordenadas por nombre. */
  listMembershipsOf(userId: string): Promise<Array<{ role: ProjectRole; project: Project }>>;

  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;

  findUserByEmail(email: string): Promise<User | null>;

  findMembersByProject(projectId: string): Promise<ProjectMemberWithUser[]>;

  addMemberWithActivity(projectId: string, userId: string, actorId: string): Promise<ProjectMember>;

  // MIR-10: Cambiar rol y quitar miembros.
  changeMemberRoleWithActivity(
    projectId: string,
    userId: string,
    actorId: string,
    newRole: ProjectRole,
  ): Promise<ProjectMember>;

  removeMemberWithActivity(projectId: string, userId: string, actorId: string): Promise<void>;

  // MIR-23: Estadisticas completas y actividad reciente.
  getProjectSummary(projectId: string): Promise<ProjectSummaryData>;
}

// MIR-10: Configuracion de transacciones.
const transactionOptions = {
  isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable,
};

async function retryOnSerializationConflict<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isConflict =
        error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2034';

      if (!isConflict || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('No se pudo completar la transaccion');
}

export function createProjectsRepository(db: Db = prisma): ProjectsRepository {
  return {
    // Buscar proyecto por clave.
    findByKey: (key) =>
      db.project.findUnique({
        where: { key },
      }),

    // Crear proyecto con OWNER.
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

    // Listar proyectos donde el usuario tiene membresia.
    listMembershipsOf: (userId) =>
      db.projectMember.findMany({
        where: { userId },
        include: { project: true },
        orderBy: { project: { name: 'asc' } },
      }),

    // Buscar membresia de un usuario.
    findMember: (projectId, userId) =>
      db.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      }),

    // Buscar usuario por correo.
    findUserByEmail: (email) =>
      db.user.findUnique({
        where: { email },
      }),

    // Listar miembros del proyecto.
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

    // MIR-9: Invitar miembro y registrar actividad.
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

    // MIR-10: Cambiar el rol de un miembro.
    async changeMemberRoleWithActivity(projectId, userId, actorId, newRole) {
      if (!('$transaction' in db)) {
        throw new Error('Se requiere una transaccion para cambiar roles');
      }

      return retryOnSerializationConflict(() =>
        db.$transaction(async (tx) => {
          const member = await tx.projectMember.findUnique({
            where: {
              userId_projectId: {
                userId,
                projectId,
              },
            },
          });

          if (!member) {
            throw new NotFoundError('Miembro', 'MEMBER_NOT_FOUND');
          }

          // Proteger al ultimo OWNER del proyecto.
          if (member.role === 'OWNER' && newRole !== 'OWNER') {
            const ownerCount = await tx.projectMember.count({
              where: {
                projectId,
                role: 'OWNER',
              },
            });

            if (ownerCount <= 1) {
              throw new BadRequestError(
                'No puedes cambiar el rol del ultimo propietario',
                'OWNER_PROTECTED',
              );
            }
          }

          // Si el rol es igual, no se modifica nada.
          if (member.role === newRole) {
            return member;
          }

          const updated = await tx.projectMember.update({
            where: {
              userId_projectId: {
                userId,
                projectId,
              },
            },
            data: {
              role: newRole,
            },
          });

          // Registrar cambio de rol.
          await tx.activityLog.create({
            data: {
              action: 'MEMBER_ROLE_CHANGED',
              projectId,
              actorId,
              field: 'role',
              fromValue: member.role,
              toValue: newRole,
            },
          });

          return updated;
        }, transactionOptions),
      );
    },

    // MIR-10: Quitar miembro del proyecto.
    async removeMemberWithActivity(projectId, userId, actorId) {
      if (!('$transaction' in db)) {
        throw new Error('Se requiere una transaccion para quitar miembros');
      }

      await retryOnSerializationConflict(() =>
        db.$transaction(async (tx) => {
          const member = await tx.projectMember.findUnique({
            where: {
              userId_projectId: {
                userId,
                projectId,
              },
            },
          });

          if (!member) {
            throw new NotFoundError('Miembro', 'MEMBER_NOT_FOUND');
          }

          // Proteger al ultimo OWNER del proyecto.
          if (member.role === 'OWNER') {
            const ownerCount = await tx.projectMember.count({
              where: {
                projectId,
                role: 'OWNER',
              },
            });

            if (ownerCount <= 1) {
              throw new BadRequestError(
                'No puedes eliminar al ultimo propietario',
                'OWNER_PROTECTED',
              );
            }
          }

          // Desasignar las tareas del usuario sin eliminarlas.
          await tx.workItem.updateMany({
            where: {
              projectId,
              assigneeId: userId,
            },
            data: {
              assigneeId: null,
            },
          });

          // Eliminar membresia.
          await tx.projectMember.delete({
            where: {
              userId_projectId: {
                userId,
                projectId,
              },
            },
          });

          // Registrar eliminacion en historial.
          await tx.activityLog.create({
            data: {
              action: 'MEMBER_REMOVED',
              projectId,
              actorId,
              field: 'member',
              fromValue: userId,
            },
          });
        }, transactionOptions),
      );
    },

    // MIR-23: Calcular estadisticas y consultar actividad reciente.
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
