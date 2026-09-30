import type { NextFunction, Request, Response } from 'express';
import type { AuthResponse, LoginInput, RegisterInput } from '@mira/shared';
import { clearAuthCookie, setAuthCookie, signToken } from '../../lib/jwt.js';
import { UnauthorizedError } from '../../lib/errors.js';
import type { AuthService } from './auth.service.js';

/**
 * Capa HTTP: traduce peticion -> caso de uso -> respuesta.
 *
 * Aqui NO hay reglas de negocio. Solo se decide el codigo de estado, se
 * emite la cookie y se delega. Si algo que parece una regla aparece en este
 * archivo, va en el service.
 */
export function createAuthController(service: AuthService) {
  return {
    async register(req: Request, res: Response, next: NextFunction) {
      try {
        const user = await service.register(req.body as RegisterInput);
        setAuthCookie(res, signToken({ sub: user.id, email: user.email }));
        // 201: el registro crea un recurso. Ademas deja la sesion iniciada,
        // para que el usuario no tenga que escribir la contrasena dos veces.
        res.status(201).json({ user } satisfies AuthResponse);
      } catch (error) {
        next(error);
      }
    },

    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const user = await service.login(req.body as LoginInput);
        setAuthCookie(res, signToken({ sub: user.id, email: user.email }));
        res.status(200).json({ user } satisfies AuthResponse);
      } catch (error) {
        next(error);
      }
    },

    logout(_req: Request, res: Response) {
      clearAuthCookie(res);
      res.status(204).send();
    },

    async me(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const user = await service.getById(req.user.id);
        res.status(200).json({ user } satisfies AuthResponse);
      } catch (error) {
        next(error);
      }
    },
  };
}
