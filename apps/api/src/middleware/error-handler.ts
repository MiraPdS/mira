import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { isProduction } from '../env.js';

/** 404 para cualquier ruta no registrada. Va despues de todos los routers. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` },
  });
};

/**
 * Manejador central de errores.
 *
 * Toda respuesta de error del sistema sale de aqui y tiene la MISMA forma
 * ({ error: { code, message, fields? } }), que es la que declara
 * apiErrorSchema en @mira/shared.  Gracias a eso el cliente tiene un unico
 * camino para mostrar errores.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) },
    });
    return;
  }

  // Violacion de restriccion unica: la traducimos a 409 en vez de 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
    res.status(409).json({
      error: { code: 'CONFLICT', message: `Ya existe un registro con ese ${target}` },
    });
    return;
  }

  // P2025: el registro a modificar ya no existe. P2003: se intento crear una
  // fila hija de algo que se borro en paralelo (p. ej. un proyecto eliminado,
  // MIR-8). En ambos casos el recurso ya no esta: 404 en vez de 500.
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === 'P2025' || err.code === 'P2003')
  ) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
    return;
  }

  // Lo que llega aqui es un bug nuestro: se registra completo en el servidor
  // pero al cliente no se le filtra el stack.
  console.error('[error no controlado]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Ocurrio un error inesperado'
        : err instanceof Error
          ? err.message
          : 'Error desconocido',
    },
  });
};
