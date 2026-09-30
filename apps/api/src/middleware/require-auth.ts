import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE, verifyToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Presente solo despues de requireAuth. */
      user?: { id: string; email: string };
    }
  }
}

/**
 * Exige sesion valida.
 *
 * Lee el JWT de la cookie httpOnly (no del header Authorization): el
 * navegador la adjunta solo, asi que el frontend no maneja el token y los
 * tests E2E de la Entrega 3 solo tienen que hacer login por UI.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[AUTH_COOKIE] as string | undefined;

  if (!token) {
    return next(new UnauthorizedError('Debes iniciar sesion'));
  }

  const payload = verifyToken(token);
  if (!payload) {
    return next(new UnauthorizedError('Sesion invalida o expirada', 'INVALID_TOKEN'));
  }

  req.user = { id: payload.sub, email: payload.email };
  next();
}
