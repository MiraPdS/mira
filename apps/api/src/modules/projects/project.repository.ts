import type { ProjectMember, User } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

export interface ProjectRepository {
  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;
  findUserByEmail(email: string): Promise<User | null>;

  addMemberWithActivity(projectId: string, userId: string, actorId: string): Promise<ProjectMember>;
}

export function createProjectRepository(db: Db = prisma): ProjectRepository {
  return {
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
  };
}
