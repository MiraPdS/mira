import { Router } from 'express';
import { env } from '../../env.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Health check del ambiente desplegado (MIR-27).
 *
 * Hace un `SELECT 1` real contra la base, por dos razones:
 *  - Render lo usa como healthCheckPath: un deploy que no alcanza la base
 *    nunca queda vivo.
 *  - El pinger externo (UptimeRobot) lo llama cada 10 minutos. Eso mantiene
 *    despierta la API en Render y, como toca la base, evita que Supabase
 *    pause el proyecto tras 7 dias sin actividad.
 *
 * No usa la forma de error estandar ({ error: { code } }) a proposito: no lo
 * consume el frontend sino monitores, que solo miran el codigo de estado.
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const base = { env: env.NODE_ENV, timestamp: new Date().toISOString() };

    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'ok', ...base });
    } catch (error) {
      console.error('[health] la base no responde', error);
      res.status(503).json({ status: 'error', db: 'error', ...base });
    }
  });

  return router;
}
