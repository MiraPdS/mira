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

/** Un campo del proyecto que cambio, tal como queda en la bitacora. */
export interface ProjectFieldChange {
  field: 'name' | 'description';
  fromValue: string | null;
  toValue: string | null;
}

/** MIR-23: actividad reciente con el nombre de quien la hizo. */
export type RecentProjectActivity = ActivityLog & {
  actor: { id: string; name: string };
};

/** MIR-23: conteos del proyecto y su actividad reciente. */
export interface ProjectSummaryData {
  total: number;
  byStatus: Record<WorkItemStatus, number>;
  byType: Record<WorkItemType, number>;
  byPriority: Record<WorkItemPriority, number>;
  recentActivity: RecentProjectActivity[];
}

/** MIR-23: cuantas actividades muestra el panel. */
export const RECENT_ACTIVITY_LIMIT = 10;

/**
 * MIR-23: campos de la bitacora que guardan el id de un usuario. El panel los
 * muestra con el nombre; un usuario que ya no existe se muestra como null.
 */
const USER_ID_FIELDS = new Set(['assigneeId', 'member']);

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

  /**
   * MIR-7: en UNA transaccion bloquea la fila del proyecto, calcula los cambios
   * con `diff` sobre ese estado bloqueado, actualiza y registra una fila
   * PROJECT_UPDATED por cambio. Devuelve null si el proyecto no existe.
   */
  updateWithActivity(
    projectId: string,
    data: { name?: string; description?: string | null },
    actorId: string,
    diff: (current: Project) => ProjectFieldChange[],
  ): Promise<Project | null>;

  // MIR-10: Cambiar rol y quitar miembros
  changeMemberRoleWithActivity(
    projectId: string,
    userId: string,
    actorId: string,
    newRole: ProjectRole,
  ): Promise<ProjectMember>;

  removeMemberWithActivity(projectId: string, userId: string, actorId: string): Promise<void>;

  /**
   * MIR-8: elimina el proyecto solo si `actorId` es miembro con alguno de
   * `roles`. La condicion de rol va en el WHERE del propio DELETE, asi que
   * comprobar y borrar es una sola sentencia atomica. Miembros, items,
   * comentarios y bitacora caen en cascada por las FK del esquema.
   */
  deleteIfMemberRole(
    projectId: string,
    actorId: string,
    roles: ProjectRole[],
  ): Promise<DeleteProjectResult>;

  /** MIR-23: conteos por estado, tipo y prioridad, y la actividad reciente. */
  getProjectSummary(projectId: string): Promise<ProjectSummaryData>;
}

/** MIR-8: resultado de eliminar; el service lo traduce a 204, 403 o 404. */
export type DeleteProjectResult =
  | { status: 'deleted'; project: Pick<Project, 'id' | 'key' | 'name'> }
  | { status: 'not_found' }
  | { status: 'forbidden' };

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
    findById: (projectId) =>
      db.project.findUnique({
        where: { id: projectId },
      }),

    // Buscar proyecto por clave
    findByKey: (key) =>
      db.project.findUnique({
        where: { key },
      }),

    // Crear proyecto con OWNER
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

    // Buscar membresia de un usuario
    findMember: (projectId, userId) =>
      db.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      }),

    // Buscar usuario por correo
    findUserByEmail: (email) =>
      db.user.findUnique({
        where: { email },
      }),

    // Listar miembros del proyecto
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

    // MIR-9: Invitar miembro y registrar actividad
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

    async updateWithActivity(projectId, data, actorId, diff) {
      const run = async (tx: Db) => {
        // FOR UPDATE: un PATCH concurrente espera aqui hasta que este confirme,
        // asi el diff (y el fromValue de la bitacora) parte del ultimo estado.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE
        `;
        if (locked.length === 0) return null;

        const current = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
        const changes = diff(current);

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

    // MIR-10: Cambiar el rol de un miembro
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

          // Solo se protege al ultimo OWNER del proyecto.
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

    // MIR-10: Quitar miembro del proyecto
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

          // Solo se protege al ultimo OWNER del proyecto.
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

    // MIR-23: Conteos y actividad reciente del proyecto.
    async getProjectSummary(projectId) {
      const [statusGroups, typeGroups, priorityGroups, activities] = await Promise.all([
        db.workItem.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
        db.workItem.groupBy({ by: ['type'], where: { projectId }, _count: { _all: true } }),
        db.workItem.groupBy({ by: ['priority'], where: { projectId }, _count: { _all: true } }),
        db.activityLog.findMany({
          where: { projectId },
          // El id desempata actividades creadas en el mismo milisegundo.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: RECENT_ACTIVITY_LIMIT,
          include: { actor: { select: { id: true, name: true } } },
        }),
      ]);

      // Partir de ceros: un proyecto vacio responde todas las claves.
      const byStatus: Record<WorkItemStatus, number> = {
        BACKLOG: 0,
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      };
      const byType: Record<WorkItemType, number> = { EPIC: 0, STORY: 0, TASK: 0, BUG: 0 };
      const byPriority: Record<WorkItemPriority, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };

      for (const group of statusGroups) byStatus[group.status] = group._count._all;
      for (const group of typeGroups) byType[group.type] = group._count._all;
      for (const group of priorityGroups) byPriority[group.priority] = group._count._all;

      // La bitacora guarda ids de usuario en algunos campos; se traducen a
      // nombres en UNA consulta para que la UI nunca muestre un id crudo.
      const userIds = new Set<string>();
      for (const activity of activities) {
        if (activity.field && USER_ID_FIELDS.has(activity.field)) {
          if (activity.fromValue) userIds.add(activity.fromValue);
          if (activity.toValue) userIds.add(activity.toValue);
        }
      }

      const users =
        userIds.size > 0
          ? await db.user.findMany({
              where: { id: { in: [...userIds] } },
              select: { id: true, name: true },
            })
          : [];
      const nameById = new Map(users.map((user) => [user.id, user.name]));
      const toName = (value: string | null) => (value ? (nameById.get(value) ?? null) : null);

      const recentActivity = activities.map((activity) =>
        activity.field && USER_ID_FIELDS.has(activity.field)
          ? {
              ...activity,
              fromValue: toName(activity.fromValue),
              toValue: toName(activity.toValue),
            }
          : activity,
      );

      return {
        total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
        byStatus,
        byType,
        byPriority,
        recentActivity,
      };
    },

    // MIR-8: eliminar el proyecto con la condicion de rol en el mismo DELETE.
    async deleteIfMemberRole(projectId, actorId, roles) {
      // Solo para el registro de auditoria y para distinguir 404 de 403.
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, key: true, name: true },
      });
      if (!project) return { status: 'not_found' };

      const { count } = await db.project.deleteMany({
        where: { id: projectId, members: { some: { userId: actorId, role: { in: roles } } } },
      });
      if (count > 0) return { status: 'deleted', project };

      // No se borro: o ya no existe (otra peticion lo elimino) o no tiene el rol.
      const sigueExistiendo = await db.project.count({ where: { id: projectId } });
      return sigueExistiendo ? { status: 'forbidden' } : { status: 'not_found' };
    },
  };
}
