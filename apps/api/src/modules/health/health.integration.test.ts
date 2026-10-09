import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../lib/prisma.js';

/**
 * El health check toca la base de verdad: es lo que Render y el pinger
 * externo usan para saber si el ambiente desplegado esta sano (MIR-27).
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
  });

  it('responde 503 cuando la base no responde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'error' });
  });
});
