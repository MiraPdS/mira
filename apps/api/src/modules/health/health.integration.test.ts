import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../lib/prisma.js';
import { DB_CHECK_TIMEOUT_MS } from './health.router.js';

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

  it(
    'responde 503 cuando la base no contesta a tiempo',
    async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      // Una consulta que nunca resuelve: el timeout es lo unico que la corta.
      vi.spyOn(prisma, '$queryRaw').mockReturnValueOnce(new Promise(() => {}) as never);

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
    },
    DB_CHECK_TIMEOUT_MS + 5_000,
  );
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
