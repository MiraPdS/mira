import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env, isProduction } from '../env.js';

export const AUTH_COOKIE = 'mira_token';

export interface TokenPayload {
  /** id del usuario */
  sub: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Devuelve el payload, o null si el token es invalido o expiro. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') return null;
    return { sub: String(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

/**
 * Opciones de la cookie de sesion.
 *
 *  httpOnly: JavaScript no puede leerla -> un XSS no puede robar el token.
 *            Es la razon por la que elegimos cookie sobre localStorage.
 *  sameSite: 'lax' siempre. En desarrollo localhost:5173 -> :3000 es el
 *            mismo sitio (el puerto no cuenta), y desplegado el navegador
 *            habla con la API por el rewrite /api de Vercel: mismo origen,
 *            cookie first-party (D13). 'lax' impide que otro sitio dispare
 *            POST con la cookie de sesion (CSRF), cosa que 'none' permitia.
 *  secure:   solo HTTPS en produccion; en local romperia el login.
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias, igual que JWT_EXPIRES_IN
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, cookieOptions());
}

export function clearAuthCookie(res: Response): void {
  // Debe usar exactamente las mismas opciones que al crearla, o el navegador
  // la trata como una cookie distinta y no la borra.
  const { maxAge: _maxAge, ...opciones } = cookieOptions();
  res.clearCookie(AUTH_COOKIE, opciones);
}
