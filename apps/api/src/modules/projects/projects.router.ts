import { Router } from 'express';
import { createProjectSchema, addMemberSchema, changeMemberRoleSchema } from '@mira/shared';
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

  // MIR-5: Crear proyecto.
  // MIR-6: Listar proyectos del usuario.
  router.get('/', controller.list);
  router.post('/', validateBody(createProjectSchema), controller.create);

  // MIR-9: Listar miembros e invitar usuarios.
  router.get('/:projectId/members', controller.listMembers);
  router.post('/:projectId/members', validateBody(addMemberSchema), controller.addMember);

  // MIR-10: Cambiar rol y quitar miembros.
  router.patch(
    '/:projectId/members/:userId/role',
    validateBody(changeMemberRoleSchema),
    controller.changeMemberRole,
  );

  router.delete('/:projectId/members/:userId', controller.removeMember);

  // MIR-23: Panel de resumen del proyecto.
  router.get('/:projectId/summary', controller.getSummary);

  return router;
}
