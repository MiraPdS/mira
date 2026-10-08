import { Router } from 'express';
import { createProjectSchema } from '@mira/shared';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { createProjectsRepository } from './projects.repository.js';
import { createProjectsService } from './projects.service.js';
import { createProjectsController } from './projects.controller.js';

/** Cableado del modulo: repositorio -> service -> controlador -> rutas. */
export function createProjectsRouter(): Router {
  const controller = createProjectsController(createProjectsService(createProjectsRepository()));
  const router = Router();

  // Todas las rutas de proyectos exigen sesion.
  router.use(requireAuth);

  router.get('/', controller.list);
  router.post('/', validateBody(createProjectSchema), controller.create);

  return router;
}
