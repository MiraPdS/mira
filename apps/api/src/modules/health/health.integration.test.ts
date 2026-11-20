import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../lib/prisma.js';
import { createHealthRouter } from './health.router.js';

/**
 * Health checks del ambiente desplegado (MIR-27): /api/health/live lo usa
 * Render y /api/health (que toca la base) lo usa el pinger externo.
 *
 * Requiere:  npm run db:up
 */

let app: Express;

beforeAll(async () => {
  // Import dinamico: la app lee `env`, que debe estar configurado por el
  // setupFile antes de que este modulo se evalue.
  const { createApp } = await import('../../app.js');
  app = createApp();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** App minima con un timeout corto, para no esperar los 2 s reales. */
function appConTimeoutCorto(): Express {
  const mini = express();
  mini.use('/api/health', createHealthRouter({ dbTimeoutMs: 50 }));
  return mini;
}

describe('GET /api/health', () => {
  it('responde 200 con la base arriba, sin requerir autenticacion', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(res.body).not.toHaveProperty('env');
  });

  it('responde 503 cuando la base no responde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'error', commit: null });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('responde 503 cuando la base no contesta a tiempo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Una consulta que nunca resuelve: el timeout es lo unico que la corta.
    vi.spyOn(prisma, '$queryRaw').mockReturnValue(new Promise(() => {}) as never);

    const res = await request(appConTimeoutCorto()).get('/api/health');

    expect(res.status).toBe(503);
  });

  it('no apila otra consulta mientras la anterior sigue colgada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const queryRaw = vi.spyOn(prisma, '$queryRaw').mockReturnValue(new Promise(() => {}) as never);
    const mini = appConTimeoutCorto();

    await request(mini).get('/api/health');
    const res = await request(mini).get('/api/health');

    expect(res.status).toBe(503);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('abandona una consulta colgada y vuelve a 200 cuando la base se recupera', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma, '$queryRaw')
      .mockReturnValueOnce(new Promise(() => {}) as never)
      .mockResolvedValueOnce([{ '?column?': 1 }] as never);
    const mini = express();
    mini.use('/api/health', createHealthRouter({ dbTimeoutMs: 50, dbAbandonMs: 20 }));

    const colgada = await request(mini).get('/api/health');
    const recuperada = await request(mini).get('/api/health');

    expect(colgada.status).toBe(503);
    expect(recuperada.status).toBe(200);
  });
});

/**
 * Commit desplegado (MIR-71): el job `Desplegar` espera a que `commit`
 * coincida con GITHUB_SHA. Fuera de Render no hay RENDER_GIT_COMMIT.
 */
describe('commit desplegado', () => {
  const SHA = '9d2e518abf9f753415401bee6a1866f045ccc402';

  // Estas pruebas miran el commit y las cabeceras, no la base. Se simula el
  // SELECT 1: despues de que otra prueba espia y restaura prisma.$queryRaw,
  // el cliente de Prisma ya no lo expone como funcion.
  beforeEach(() => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as never);
  });

  function appConCommit(): Express {
    const mini = express();
    mini.use('/api/health', createHealthRouter({ commit: SHA }));
    return mini;
  }

  it.each(['/api/health', '/api/health/live'])('%s responde el commit inyectado', async (ruta) => {
    const res = await request(appConCommit()).get(ruta);

    expect(res.status).toBe(200);
    expect(res.body.commit).toBe(SHA);
  });

  it.each(['/api/health', '/api/health/live'])(
    '%s responde commit null sin RENDER_GIT_COMMIT',
    async (ruta) => {
      const res = await request(app).get(ruta);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('commit', null);
    },
  );

  it.each(['/api/health', '/api/health/live'])('%s no se puede cachear', async (ruta) => {
    const res = await request(app).get(ruta);

    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/health/live', () => {
  it('responde 200 sin tocar la base', async () => {
    const queryRaw = vi.spyOn(prisma, '$queryRaw');

    const res = await request(app).get('/api/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
