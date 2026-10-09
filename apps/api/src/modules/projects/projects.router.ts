import { Router } from 'express';
import { addMemberSchema, createProjectSchema, updateProjectSchema } from '@mira/shared';
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

  // MIR-5: crear proyecto. MIR-6: listar los proyectos del usuario.
  router.get('/', controller.list);
  router.post('/', validateBody(createProjectSchema), controller.create);

  // MIR-7: ver y editar un proyecto.
  router.get('/:projectId', controller.get);
  router.patch('/:projectId', validateBody(updateProjectSchema), controller.update);

  // MIR-9: Listar miembros e invitar usuarios.
  router.get('/:projectId/members', controller.listMembers);
  router.post('/:projectId/members', validateBody(addMemberSchema), controller.addMember);

  return router;
}
