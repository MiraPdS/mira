import type { ProjectRole } from '@mira/shared';
import { prisma, type Db } from '../../lib/prisma.js';

export interface CommentForDto {
  id: string;
  body: string;
  author: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  };
  createdAt: Date;
}

export interface CreateCommentData {
  projectId: string;
  workItemId: string;
  actorId: string;
  body: string;
}

export interface CommentRepository {
  findMemberRole(projectId: string, userId: string): Promise<ProjectRole | null>;
  workItemExists(projectId: string, workItemId: string): Promise<boolean>;
  /**
   * Crea el comentario y su COMMENT_ADDED en una transaccion. Devuelve null si
   * el elemento ya no existe (por ejemplo, otro usuario lo elimino recien).
   */
  createAtomically(data: CreateCommentData): Promise<CommentForDto | null>;
  listByWorkItem(workItemId: string): Promise<CommentForDto[]>;
}

const authorForDto = {
  select: {
    id: true,
    name: true,
    email: true,
    createdAt: true,
  },
} as const;

export function createCommentRepository(db: Db = prisma): CommentRepository {
  return {
    async findMemberRole(projectId, userId) {
      const member = await db.projectMember.findUnique({
        where: {
          userId_projectId: { userId, projectId },
        },
        select: { role: true },
      });

      return member?.role ?? null;
    },

    async workItemExists(projectId, workItemId) {
      const item = await db.workItem.findFirst({
        where: { id: workItemId, projectId },
        select: { id: true },
      });

      return item !== null;
    },

    async createAtomically(data) {
      const create = async (tx: Db) => {
        // FOR UPDATE: la eliminacion concurrente del elemento espera a que este
        // comentario confirme, o bien ya ocurrio y aqui no se encuentra la fila.
        // Sin este bloqueo, la FK fallaria con P2003 y el cliente veria un 500.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM work_items
          WHERE id = ${data.workItemId} AND "projectId" = ${data.projectId}
          FOR UPDATE
        `;
        if (locked.length === 0) return null;

        const comment = await tx.comment.create({
          data: {
            body: data.body,
            workItemId: data.workItemId,
            authorId: data.actorId,
          },
          include: { author: authorForDto },
        });

        await tx.activityLog.create({
          data: {
            action: 'COMMENT_ADDED',
            projectId: data.projectId,
            workItemId: data.workItemId,
            actorId: data.actorId,
          },
        });

        return comment;
      };

      if (!('$transaction' in db)) {
        return create(db);
      }

      return db.$transaction((tx) => create(tx));
    },

    async listByWorkItem(workItemId) {
      return db.comment.findMany({
        where: { workItemId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { author: authorForDto },
      });
    },
  };
}
