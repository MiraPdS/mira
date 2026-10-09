import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { addMember, createProject, createUser, sessionCookie } from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';
import { createProjectsRepository } from './projects.repository.js';

/**
 * NIVEL 2 de la piramide: integracion.
 *
 * Supertest contra la app real y Postgres de pruebas. Cubre los criterios de
 * aceptacion de MIR-5 (201 + OWNER, 409 por clave repetida, 422 por formato y
 * 401 sin sesion), de MIR-6 (solo los proyectos propios, con su rol) y de
 * MIR-7 (ver y editar: 200 al OWNER, 403 al resto, 422 por campos ajenos).
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

describe('GET /api/projects', () => {
  it('devuelve exactamente los proyectos del usuario, con su rol en cada uno', async () => {
    const user = await createUser();
    const { project: propio } = await createProject({ owner: user, name: 'Alfa' });
    const { project: ajenoInvitado } = await createProject({ name: 'Beta' });
    await addMember(ajenoInvitado, user, 'VIEWER');

    const res = await request(app).get('/api/projects').set('Cookie', sessionCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(2);
    expect(res.body.projects.map((p: { id: string; myRole: string }) => [p.id, p.myRole])).toEqual([
      [propio.id, 'OWNER'],
      [ajenoInvitado.id, 'VIEWER'],
    ]);
  });

  it('no incluye proyectos de los que el usuario no es miembro', async () => {
    const user = await createUser();
    await createProject({ owner: user, name: 'Alfa' });
    const { project: ajeno } = await createProject({ name: 'Beta' });

    const res = await request(app).get('/api/projects').set('Cookie', sessionCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.projects.map((p: { id: string }) => p.id)).not.toContain(ajeno.id);
    expect(res.body.projects).toHaveLength(1);
  });

  it('devuelve una lista vacia si el usuario no participa en ningun proyecto', async () => {
    const user = await createUser();
    await createProject({ name: 'Ajeno' });

    const res = await request(app).get('/api/projects').set('Cookie', sessionCookie(user));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [] });
  });

  it('ordena los proyectos por nombre', async () => {
    const user = await createUser();
    // Misma capitalizacion para no depender del collation de Postgres.
    for (const name of ['Gamma', 'Alfa', 'Beta']) {
      await createProject({ owner: user, name });
    }

    const res = await request(app).get('/api/projects').set('Cookie', sessionCookie(user));

    expect(res.body.projects.map((p: { name: string }) => p.name)).toEqual([
      'Alfa',
      'Beta',
      'Gamma',
    ]);
  });

  it('responde 401 sin sesion', async () => {
    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects/:projectId', () => {
  it('devuelve el proyecto con el rol del miembro', async () => {
    const user = await createUser();
    const { project } = await createProject({ name: 'Mira' });
    await addMember(project, user, 'VIEWER');

    const res = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({ id: project.id, name: 'Mira', myRole: 'VIEWER' });
  });

  it('responde 403 a quien no es miembro', async () => {
    const user = await createUser();
    const { project } = await createProject();

    const res = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(user));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it('responde 403 si el proyecto no existe', async () => {
    const user = await createUser();

    const res = await request(app)
      .get('/api/projects/no-existe')
      .set('Cookie', sessionCookie(user));

    expect(res.status).toBe(403);
  });

  it('responde 401 sin sesion', async () => {
    const { project } = await createProject();

    const res = await request(app).get(`/api/projects/${project.id}`);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/projects/:projectId', () => {
  it('CA1: el OWNER edita nombre y descripcion, responde 200 y persiste', async () => {
    const { project, owner } = await createProject({ name: 'Mira', description: 'Antes' });

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner))
      .send({ name: '  Mira 2 ', description: 'Despues' });

    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({
      name: 'Mira 2',
      description: 'Despues',
      key: project.key,
      myRole: 'OWNER',
    });

    const visto = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));
    expect(visto.body.project).toMatchObject({ name: 'Mira 2', description: 'Despues' });
  });

  it('una descripcion en blanco queda como null', async () => {
    const { project, owner } = await createProject({ description: 'Antes' });

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner))
      .send({ description: '   ' });

    expect(res.status).toBe(200);
    expect(res.body.project.description).toBeNull();
  });

  it.each(['MEMBER', 'VIEWER'] as const)(
    'CA2: responde 403 a un %s y no cambia nada',
    async (role) => {
      const user = await createUser();
      const { project } = await createProject({ name: 'Mira' });
      await addMember(project, user, role);

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set('Cookie', sessionCookie(user))
        .send({ name: 'Hackeado' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_REQUIRED');
      expect((await prisma.project.findUnique({ where: { id: project.id } }))?.name).toBe('Mira');
    },
  );

  it('responde 403 a quien no es miembro', async () => {
    const user = await createUser();
    const { project } = await createProject();

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(user))
      .send({ name: 'Ajeno' });

    expect(res.status).toBe(403);
  });

  it.each([
    ['un campo desconocido', { name: 'Mira', color: 'rojo' }],
    ['la clave (inmutable)', { key: 'NUEVA' }],
    ['un cuerpo vacio', {}],
  ])('CA3: responde 422 con %s', async (_caso, body) => {
    const { project, owner } = await createProject();

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner))
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('registra PROJECT_UPDATED solo por los campos que cambian', async () => {
    const { project, owner } = await createProject({ name: 'Mira', description: 'Antes' });

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner))
      .send({ name: 'Mira', description: null });

    const filas = await prisma.activityLog.findMany({
      where: { projectId: project.id, action: 'PROJECT_UPDATED' },
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      actorId: owner.id,
      workItemId: null,
      field: 'description',
      fromValue: 'Antes',
      toValue: null,
    });
  });

  it('un PATCH con los mismos valores responde 200 y no deja bitacora', async () => {
    const { project, owner } = await createProject({ name: 'Mira', description: 'Antes' });

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner))
      .send({ name: 'Mira', description: 'Antes' });

    expect(res.status).toBe(200);
    expect(await prisma.activityLog.count({ where: { action: 'PROJECT_UPDATED' } })).toBe(0);
  });

  it('dos PATCH concurrentes dejan una bitacora encadenada y coherente con el estado final', async () => {
    const { project, owner } = await createProject({ name: 'Mira' });
    const enviar = (name: string) =>
      request(app)
        .patch(`/api/projects/${project.id}`)
        .set('Cookie', sessionCookie(owner))
        .send({ name });

    // Una transaccion externa retiene la fila para que ambos PATCH se solapen
    // de verdad: los dos llegan mientras esta bloqueada y se liberan juntos.
    let liberar!: () => void;
    const soltar = new Promise<void>((resolve) => (liberar = resolve));
    let avisarBloqueo!: () => void;
    const bloqueada = new Promise<void>((resolve) => (avisarBloqueo = resolve));
    const retencion = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM projects WHERE id = ${project.id} FOR UPDATE`;
        avisarBloqueo();
        await soltar;
      },
      { timeout: 10_000 },
    );
    await bloqueada;

    const pendientes = Promise.all([enviar('Alfa'), enviar('Beta')]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    liberar();
    await retencion;

    const respuestas = await pendientes;
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);

    // Sin el bloqueo, ambas filas tendrian fromValue "Mira".
    const filas = await prisma.activityLog.findMany({
      where: { projectId: project.id, action: 'PROJECT_UPDATED' },
    });
    expect(filas).toHaveLength(2);
    const primera = filas.find((f) => f.fromValue === 'Mira');
    const segunda = filas.find((f) => f.fromValue === primera?.toValue);
    expect(primera).toBeDefined();
    expect(segunda).toBeDefined();

    const final = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(final.name).toBe(segunda?.toValue);
  });

  it('si falla el registro en la bitacora, el proyecto no cambia (rollback)', async () => {
    const { project } = await createProject({ name: 'Mira' });
    const repo = createProjectsRepository(prisma);

    // Un actor inexistente viola la FK de activity_log al insertar la fila.
    await expect(
      repo.updateWithActivity(project.id, { name: 'Otro' }, 'actor-inexistente', (actual) => [
        { field: 'name', fromValue: actual.name, toValue: 'Otro' },
      ]),
    ).rejects.toThrow();

    const tras = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(tras.name).toBe('Mira');
  });

  it('responde 401 sin sesion', async () => {
    const { project } = await createProject();

    const res = await request(app).patch(`/api/projects/${project.id}`).send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});
