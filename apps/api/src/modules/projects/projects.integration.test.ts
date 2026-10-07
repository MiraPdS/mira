import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createProject, createUser, sessionCookie } from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * NIVEL 2 de la piramide: integracion.
 *
 * Supertest contra la app real y Postgres de pruebas. Cubre los criterios de
 * aceptacion de MIR-5: 201 + OWNER, 409 por clave repetida, 422 por formato y
 * 401 sin sesion.
 *
 * Requiere:  npm run db:up
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

describe('POST /api/projects', () => {
  it('crea el proyecto, responde 201 y deja al creador como OWNER', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie(user))
      .send({ name: 'Mira', key: 'MIR', description: 'Gestor de proyectos' });

    expect(res.status).toBe(201);
    expect(res.body.project).toMatchObject({
      name: 'Mira',
      key: 'MIR',
      description: 'Gestor de proyectos',
      myRole: 'OWNER',
    });

    const membresia = await prisma.projectMember.findFirst({
      where: { projectId: res.body.project.id, userId: user.id },
    });
    expect(membresia?.role).toBe('OWNER');
  });

  it('normaliza la clave a mayusculas antes de guardarla', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie(user))
      .send({ name: 'Mira', key: ' mir ' });

    expect(res.status).toBe(201);
    expect(res.body.project.key).toBe('MIR');
  });

  it('responde 409 si la clave ya existe', async () => {
    await createProject({ key: 'MIR' });
    const user = await createUser();

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie(user))
      .send({ name: 'Otro proyecto', key: 'MIR' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROJECT_KEY_TAKEN');
    expect(res.body.error.message).toMatch(/MIR/);
  });

  it('responde 409 aunque la clave repetida venga en minusculas', async () => {
    await createProject({ key: 'MIR' });
    const user = await createUser();

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie(user))
      .send({ name: 'Otro proyecto', key: 'mir' });

    expect(res.status).toBe(409);
  });

  it.each([
    ['M', 'muy corta'],
    ['MIRA20261', 'muy larga'],
    ['1MIR', 'empieza con numero'],
    ['MI-R', 'caracter no alfanumerico'],
  ])('responde 422 con la clave %s (%s)', async (key) => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie(user))
      .send({ name: 'Mira', key });

    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('key');
  });

  it('responde 401 sin sesion y no crea nada', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Mira', key: 'MIR' });

    expect(res.status).toBe(401);
    expect(await prisma.project.count()).toBe(0);
  });
});
