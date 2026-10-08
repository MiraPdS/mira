import type { NextFunction, Request, Response } from 'express';
import type { CommentDto, CreateCommentInput } from '@mira/shared';
import { UnauthorizedError } from '../../lib/errors.js';
import type { CommentService } from './comment.service.js';

type CommentResponse = { comment: CommentDto };
type CommentsResponse = { comments: CommentDto[] };

/**
 * Controlador HTTP de comentarios.
 *
 * La autenticación se comprueba en el router.
 * Los permisos y las reglas de negocio pertenecen al servicio.
 */
export function createCommentController(service: CommentService) {
  return {
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const comment = await service.create(
          req.params.projectId!,
          req.user.id,
          req.params.workItemId!,
          req.body as CreateCommentInput,
        );

        res.status(201).json({ comment } satisfies CommentResponse);
      } catch (error) {
        next(error);
      }
    },

    async list(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const comments = await service.list(
          req.params.projectId!,
          req.user.id,
          req.params.workItemId!,
        );

        res.status(200).json({ comments } satisfies CommentsResponse);
      } catch (error) {
        next(error);
      }
    },
  };
}
