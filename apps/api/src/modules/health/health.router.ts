import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

/** Tope para el SELECT 1: un pooler colgado no debe dejar el probe esperando. */
export const DB_CHECK_TIMEOUT_MS = 2_000;

/**
 * Health checks del ambiente desplegado (MIR-27). Son dos a proposito:
 *
 *  GET /api/health/live  Liveness, sin base. Lo usa Render (healthCheckPath):
 *                        si dependiera de Supabase, un parpadeo del pooler
 *                        haria que Render reinicie una API sana. Que la base
 *                        este alcanzable ya lo garantiza el build, porque
 *                        `prisma migrate deploy` falla si no lo esta.
 *  GET /api/health       Hace un SELECT 1 real. Lo llama el pinger externo
 *                        (UptimeRobot): mantiene despierta la API en Render,
 *                        evita que Supabase pause el proyecto tras 7 dias sin
 *                        actividad y avisa si la base cae.
 *
 * No usan la forma de error estandar ({ error: { code } }): no los consume el
 * frontend sino monitores, que solo miran el codigo de estado.
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/', async (_req, res) => {
    const timestamp = new Date().toISOString();
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`SELECT 1 supero ${DB_CHECK_TIMEOUT_MS} ms`)),
            DB_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      res.json({ status: 'ok', db: 'ok', timestamp });
    } catch (error) {
      console.error('[health] la base no responde', error);
      res.status(503).json({ status: 'error', db: 'error', timestamp });
    } finally {
      clearTimeout(timer);
    }
  });

  return router;
}
