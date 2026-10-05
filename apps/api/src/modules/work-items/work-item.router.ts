import { Router } from 'express';
import { createWorkItemSchema } from '@mira/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody } from '../../middleware/validate.js';
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

  router.post(
    '/:projectId/work-items',
    requireAuth,
    validateBody(createWorkItemSchema),
    controller.create,
  );

  return router;
}
