import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodError, ZodTypeAny, z } from 'zod';
import { ValidationError } from '../lib/errors.js';

/** Convierte los issues de Zod al formato { campo: [mensajes] } de la API. */
function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Valida req.body contra un esquema de @mira/shared y REEMPLAZA el body por
 * el resultado parseado.
 *
 * El reemplazo es intencional: asi el controlador recibe datos ya
 * normalizados (correo en minuscula, strings sin espacios, defaults
 * aplicados) y no puede olvidarse de normalizar.
 */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError(toFieldErrors(result.error)));
    }
    req.body = result.data as z.infer<T>;
    next();
  };
}

/**
 * Igual que validateBody pero para la query string (busqueda, filtros,
 * paginacion).  El resultado queda en `res.locals.query`, ya tipado y con los
 * defaults aplicados: en Express 5 `req.query` es un getter de solo lectura,
 * asi que sobrescribirlo no es una opcion portable.
 */
export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ValidationError(toFieldErrors(result.error)));
    }
    res.locals.query = result.data;
    next();
  };
}

/** Lee la query ya validada. Usar solo en rutas que pasaron por validateQuery. */
export function validatedQuery<T>(res: Response): T {
  return res.locals.query as T;
}
