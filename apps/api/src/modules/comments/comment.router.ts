import { Router } from 'express';
import { createCommentSchema } from '@mira/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody } from '../../middleware/validate.js';
import { createCommentController } from './comment.controller.js';
import { createCommentRepository } from './comment.repository.js';
import { createCommentService } from './comment.service.js';

/**
 * Rutas de comentarios.
 *
 * Se monta en /api/projects.
 */
export function createCommentRouter(): Router {
  const repository = createCommentRepository();
  const service = createCommentService(repository);
  const controller = createCommentController(service);
  const router = Router();

  router.get('/:projectId/work-items/:workItemId/comments', requireAuth, controller.list);

  router.post(
    '/:projectId/work-items/:workItemId/comments',
    requireAuth,
    validateBody(createCommentSchema),
    controller.create,
  );

  return router;
}
