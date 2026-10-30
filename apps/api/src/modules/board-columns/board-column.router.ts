import { Router } from 'express';
import {
  createBoardColumnSchema,
  deleteBoardColumnQuerySchema,
  reorderBoardColumnsSchema,
  updateBoardColumnSchema,
} from '@mira/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { createBoardColumnController } from './board-column.controller.js';
import { createBoardColumnRepository } from './board-column.repository.js';
import { createBoardColumnService } from './board-column.service.js';

/**
 * Cableado del modulo de columnas (MIR-48). Se monta en /api/projects:
 *
 *   GET    /:projectId/columns
 *   POST   /:projectId/columns
 *   PUT    /:projectId/columns/order
 *   PATCH  /:projectId/columns/:columnId
 *   DELETE /:projectId/columns/:columnId?moveTo=<columnId>
 */
export function createBoardColumnRouter(): Router {
  const controller = createBoardColumnController(
    createBoardColumnService(createBoardColumnRepository()),
  );
  const router = Router();

  router.get('/:projectId/columns', requireAuth, controller.list);
  router.post(
    '/:projectId/columns',
    requireAuth,
    validateBody(createBoardColumnSchema),
    controller.create,
  );
  router.put(
    '/:projectId/columns/order',
    requireAuth,
    validateBody(reorderBoardColumnsSchema),
    controller.reorder,
  );
  router.patch(
    '/:projectId/columns/:columnId',
    requireAuth,
    validateBody(updateBoardColumnSchema),
    controller.update,
  );
  router.delete(
    '/:projectId/columns/:columnId',
    requireAuth,
    validateQuery(deleteBoardColumnQuerySchema),
    controller.delete,
  );

  return router;
}
