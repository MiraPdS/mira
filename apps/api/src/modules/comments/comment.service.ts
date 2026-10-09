import { can, type CommentDto, type CreateCommentInput, type Permission } from '@mira/shared';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CommentForDto, CommentRepository } from './comment.repository.js';

export function toCommentDto(comment: CommentForDto): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      email: comment.author.email,
      createdAt: comment.author.createdAt.toISOString(),
    },
    createdAt: comment.createdAt.toISOString(),
  };
}

export function createCommentService(repo: CommentRepository) {
  /**
   * Autorizacion comun de create y list. Un no miembro recibe 404 (no se
   * revela que el elemento existe); un miembro sin el permiso, 403.
   */
  async function assertAccess(projectId: string, actorId: string, permission: Permission) {
    const role = await repo.findMemberRole(projectId, actorId);

    if (role === null) {
      throw new NotFoundError('Elemento de trabajo');
    }

    if (!can(role, permission)) {
      throw new ForbiddenError();
    }
  }

  return {
    async create(
      projectId: string,
      actorId: string,
      workItemId: string,
      input: CreateCommentInput,
    ): Promise<CommentDto> {
      await assertAccess(projectId, actorId, 'comment:create');

      // createAtomically verifica y bloquea el elemento dentro de la
      // transaccion: null si no existe en este proyecto. El body ya llega
      // recortado por createCommentSchema.
      const comment = await repo.createAtomically({
        projectId,
        workItemId,
        actorId,
        body: input.body,
      });

      if (!comment) {
        throw new NotFoundError('Elemento de trabajo');
      }

      return toCommentDto(comment);
    },

    async list(projectId: string, actorId: string, workItemId: string): Promise<CommentDto[]> {
      await assertAccess(projectId, actorId, 'work-item:view');

      const exists = await repo.workItemExists(projectId, workItemId);

      if (!exists) {
        throw new NotFoundError('Elemento de trabajo');
      }

      const comments = await repo.listByWorkItem(workItemId);

      return comments.map(toCommentDto);
    },
  };
}

export type CommentService = ReturnType<typeof createCommentService>;
