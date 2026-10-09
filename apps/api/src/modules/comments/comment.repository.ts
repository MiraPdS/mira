import type { ProjectRole } from '@mira/shared';
import { findMemberRole, hasTransaction, prisma, type Db } from '../../lib/prisma.js';

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
  /** Los ultimos `limit` comentarios, del mas antiguo al mas reciente. */
  listByWorkItem(workItemId: string, limit?: number): Promise<CommentForDto[]>;
}

/**
 * Tope del listado: un elemento con cientos de comentarios (hasta 5000
 * caracteres cada uno) no debe generar respuestas de varios MB. Se devuelven
 * los mas recientes, que son los que importan para coordinarse.
 */
export const COMMENT_LIST_LIMIT = 100;

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
    findMemberRole: (projectId, userId) => findMemberRole(db, projectId, userId),

    async workItemExists(projectId, workItemId) {
      const item = await db.workItem.findFirst({
        where: { id: workItemId, projectId },
        select: { id: true },
      });

      return item !== null;
    },

    async createAtomically(data) {
      const create = async (tx: Db) => {
        // FOR KEY SHARE (el mismo bloqueo que toma la FK): impide que el
        // elemento se borre hasta que este comentario confirme, sin bloquear
        // ediciones ni otros comentarios. FOR UPDATE podia terminar en deadlock
        // con deleteInTransaction. Si el elemento ya no existe, no hay fila y
        // se devuelve null en vez de fallar la FK con P2003 (500).
        const [workItem] = await tx.$queryRaw<Array<{ reference: string }>>`
          SELECT reference FROM work_items
          WHERE id = ${data.workItemId} AND "projectId" = ${data.projectId}
          FOR KEY SHARE
        `;
        if (!workItem) return null;

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
            // Si el elemento se elimina, workItemId pasa a null (SetNull); la
            // referencia mantiene legible la actividad, igual que ITEM_DELETED.
            field: 'reference',
            toValue: workItem.reference,
          },
        });

        return comment;
      };

      if (!hasTransaction(db)) {
        return create(db);
      }

      return db.$transaction((tx) => create(tx));
    },

    async listByWorkItem(workItemId, limit = COMMENT_LIST_LIMIT) {
      // Se piden los mas recientes y se invierten: la UI los muestra del mas
      // antiguo al mas reciente.
      const recientes = await db.comment.findMany({
        where: { workItemId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        include: { author: authorForDto },
      });
      return recientes.reverse();
    },
  };
}
