import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
    expect(res.body).toMatchObject({ status: 'error', db: 'error' });
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
