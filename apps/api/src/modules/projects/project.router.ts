import { Router } from 'express';
import { addMemberSchema } from '@mira/shared';

import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody } from '../../middleware/validate.js';
import { createProjectRepository } from './project.repository.js';
import { createProjectService } from './project.service.js';
import { createProjectController } from './project.controller.js';

export function createProjectRouter(): Router {
  const controller = createProjectController(createProjectService(createProjectRepository()));

  const router = Router();

  router.post(
    '/:projectId/members',
    requireAuth,
    validateBody(addMemberSchema),
    controller.addMember,
  );

  return router;
}
