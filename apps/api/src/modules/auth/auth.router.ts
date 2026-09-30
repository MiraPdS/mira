import { Router } from 'express';
import { loginSchema, registerSchema } from '@mira/shared';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';

/**
 * Cableado del modulo: repositorio -> service -> controlador -> rutas.
 *
 * Es el UNICO lugar del modulo que conoce las tres capas a la vez. Cada pieza
 * por separado recibe sus dependencias por parametro, y por eso se puede
 * testear aislada.
 */
export function createAuthRouter(): Router {
  const controller = createAuthController(createAuthService(createAuthRepository()));
  const router = Router();

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', validateBody(loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
