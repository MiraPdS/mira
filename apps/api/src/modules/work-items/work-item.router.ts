import { Router } from 'express';
import { createWorkItemSchema, paginationQuerySchema, updateWorkItemSchema } from '@mira/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { createWorkItemController } from './work-item.controller.js';
import { createWorkItemRepository } from './work-item.repository.js';
import { createWorkItemService } from './work-item.service.js';

/**
 * Cableado del modulo: repositorio -> service -> controlador -> rutas.
 *
 * Se monta en /api/projects, por lo que esta ruta produce finalmente
 * POST /api/projects/:projectId/work-items.
 */
export function createWorkItemRouter(): Router {
  const controller = createWorkItemController(createWorkItemService(createWorkItemRepository()));
  const router = Router();

  router.get(
    '/:projectId/work-items',
    requireAuth,
    validateQuery(paginationQuerySchema),
    controller.list,
  );

  router.post(
    '/:projectId/work-items',
    requireAuth,
    validateBody(createWorkItemSchema),
    controller.create,
  );
  router.get('/:projectId/work-items/:workItemId', requireAuth, controller.getById);
  router.patch(
    '/:projectId/work-items/:workItemId',
    requireAuth,
    validateBody(updateWorkItemSchema),
    controller.update,
  );

  return router;
}
