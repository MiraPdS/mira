import { Prisma as PrismaRuntime } from '@prisma/client';
import type { Prisma, Project, ProjectMember, ProjectRole, User } from '@prisma/client';

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

  // MIR-10: Cambiar rol y quitar miembros

  changeMemberRoleWithActivity(
    projectId: string,
    userId: string,
    actorId: string,
    newRole: ProjectRole,
  ): Promise<ProjectMember>;

  removeMemberWithActivity(projectId: string, userId: string, actorId: string): Promise<void>;
}

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

          // Ningun OWNER puede ser degradado
          if (member.role === 'OWNER' && newRole !== 'OWNER') {
            throw new BadRequestError(
              'No puedes cambiar el rol de un propietario',
              'OWNER_PROTECTED',
            );
          }

          // Si el rol es igual, no se modifica nada
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

          // Registrar cambio de rol
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

          // Ningun OWNER puede ser eliminado
          if (member.role === 'OWNER') {
            throw new BadRequestError('No puedes eliminar a un propietario', 'OWNER_PROTECTED');
          }

          // Desasignar las tareas del usuario
          // sin eliminarlas
          await tx.workItem.updateMany({
            where: {
              projectId,
              assigneeId: userId,
            },
            data: {
              assigneeId: null,
            },
          });

          // Eliminar membresia
          await tx.projectMember.delete({
            where: {
              userId_projectId: {
                userId,
                projectId,
              },
            },
          });

          // Registrar eliminacion en historial
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
  };
}
