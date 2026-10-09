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
export function createHealthRouter({ dbTimeoutMs = DB_CHECK_TIMEOUT_MS } = {}): Router {
  const router = Router();

  // El timeout corta la respuesta HTTP, no la consulta: un SELECT 1 colgado
  // sigue ocupando la unica conexion del pool (connection_limit=1). Mientras
  // haya uno en curso no se lanza otro, para no apilar consultas abandonadas
  // delante de las peticiones reales.
  let consultaEnCurso: Promise<unknown> | null = null;

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/', async (_req, res) => {
    const timestamp = new Date().toISOString();
    let timer: NodeJS.Timeout | undefined;

    if (!consultaEnCurso) {
      consultaEnCurso = prisma.$queryRaw`SELECT 1`.finally(() => {
        consultaEnCurso = null;
      });
    }

    try {
      await Promise.race([
        consultaEnCurso,
        new Promise((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`SELECT 1 supero ${dbTimeoutMs} ms`)),
            dbTimeoutMs,
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
