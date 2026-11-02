import { Router } from 'express';
import { closeSprintSchema, createSprintSchema, updateSprintSchema } from '@mira/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody } from '../../middleware/validate.js';
import { createSprintController } from './sprint.controller.js';
import { createSprintRepository } from './sprint.repository.js';
import { createSprintService } from './sprint.service.js';

export function createSprintRouter(): Router {
  const controller = createSprintController(createSprintService(createSprintRepository()));
  const router = Router();
  router.post('/:projectId/sprints/:sprintId/start', requireAuth, controller.start);
  router.post(
    '/:projectId/sprints/:sprintId/close',
    requireAuth,
    validateBody(closeSprintSchema),
    controller.close,
  );
  router.get('/:projectId/sprints', requireAuth, controller.list);
  router.post(
    '/:projectId/sprints',
    requireAuth,
    validateBody(createSprintSchema),
    controller.create,
  );
  router.patch(
    '/:projectId/sprints/:sprintId',
    requireAuth,
    validateBody(updateSprintSchema),
    controller.update,
  );
  router.delete('/:projectId/sprints/:sprintId', requireAuth, controller.delete);
  return router;
}
