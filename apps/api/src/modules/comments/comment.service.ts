import { can, type CommentDto, type CreateCommentInput } from '@mira/shared';
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
  return {
    async create(
      projectId: string,
      actorId: string,
      workItemId: string,
      input: CreateCommentInput,
    ): Promise<CommentDto> {
      const role = await repo.findMemberRole(projectId, actorId);

      if (role === null) {
        throw new NotFoundError('Elemento de trabajo');
      }

      if (!can(role, 'comment:create')) {
        throw new ForbiddenError();
      }

      const exists = await repo.workItemExists(projectId, workItemId);

      if (!exists) {
        throw new NotFoundError('Elemento de trabajo');
      }

      const comment = await repo.createAtomically({
        projectId,
        workItemId,
        actorId,
        body: input.body.trim(),
      });

      return toCommentDto(comment);
    },

    async list(projectId: string, actorId: string, workItemId: string): Promise<CommentDto[]> {
      const role = await repo.findMemberRole(projectId, actorId);

      if (role === null) {
        throw new NotFoundError('Elemento de trabajo');
      }

      if (!can(role, 'work-item:view')) {
        throw new ForbiddenError();
      }

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
