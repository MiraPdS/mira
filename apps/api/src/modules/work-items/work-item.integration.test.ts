import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { User } from '@prisma/client';
import { addMember, createProject, createUser, PASSWORD_DE_PRUEBA } from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * NIVEL 2 de la piramide: integracion.
 *
 * Supertest recorre la app Express real, middleware de autenticacion y Zod,
 * service, repository y PostgreSQL de pruebas. No se mockea ninguna capa.
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

/** Extrae la cookie httpOnly emitida por el login real. */
function cookieDeSesion(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((cookie) => cookie.startsWith('mira_token='));
}

async function iniciarSesion(user: User): Promise<string> {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: PASSWORD_DE_PRUEBA });

  expect(login.status).toBe(200);
  const cookie = cookieDeSesion(login);
  if (!cookie) throw new Error('El login de prueba no entrego una cookie de sesion');
  return cookie;
}

function rutaDeCreacion(projectId: string): string {
  return `/api/projects/${projectId}/work-items`;
}

describe('POST /api/projects/:projectId/work-items', () => {
  it('crea el primer item con defaults, referencia correlativa y actividad', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const member = await createUser({ email: 'member@mira.test' });
    await addMember(project, member, 'MEMBER');
    const cookie = await iniciarSesion(member);

    const res = await request(app)
      .post(rutaDeCreacion(project.id))
      .set('Cookie', cookie)
      .send({ title: 'Primer elemento' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('item');
    expect(res.body.item).toMatchObject({
      reference: 'MIR-1',
      projectId: project.id,
      title: 'Primer elemento',
      type: 'TASK',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      assignee: null,
      sprintId: null,
      createdBy: { id: member.id, email: member.email },
    });

    const item = await prisma.workItem.findUnique({ where: { reference: 'MIR-1' } });
    expect(item).toMatchObject({
      projectId: project.id,
      createdById: member.id,
      title: 'Primer elemento',
      type: 'TASK',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      assigneeId: null,
      sprintId: null,
    });

    const updatedProject = await prisma.project.findUnique({ where: { id: project.id } });
    expect(updatedProject?.itemCounter).toBe(1);

    const activities = await prisma.activityLog.findMany({ where: { projectId: project.id } });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      action: 'ITEM_CREATED',
      projectId: project.id,
      workItemId: item?.id,
      actorId: member.id,
    });
    expect(activities).not.toContainEqual(expect.objectContaining({ action: 'ITEM_ASSIGNED' }));
  });

  it('usa el contador incrementado al generar la referencia', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await prisma.project.update({ where: { id: project.id }, data: { itemCounter: 5 } });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .post(rutaDeCreacion(project.id))
      .set('Cookie', cookie)
      .send({ title: 'Item despues del contador inicial' });

    expect(res.status).toBe(201);
    expect(res.body.item.reference).toBe('MIR-6');

    const updatedProject = await prisma.project.findUnique({ where: { id: project.id } });
    expect(updatedProject?.itemCounter).toBe(6);
    expect(await prisma.workItem.findUnique({ where: { reference: 'MIR-6' } })).not.toBeNull();
  });

  it('rechaza a VIEWER sin crear datos ni incrementar el contador', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const viewer = await createUser({ email: 'viewer@mira.test' });
    await addMember(project, viewer, 'VIEWER');
    const cookie = await iniciarSesion(viewer);

    const res = await request(app)
      .post(rutaDeCreacion(project.id))
      .set('Cookie', cookie)
      .send({ title: 'El viewer no puede crear' });

    expect(res.status).toBe(403);
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(0);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.itemCounter).toBe(0);
    expect(await prisma.activityLog.count({ where: { projectId: project.id } })).toBe(0);
  });

  it('rechaza a un usuario que no pertenece al proyecto sin efectos secundarios', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const outsider = await createUser({ email: 'outsider@mira.test' });
    const cookie = await iniciarSesion(outsider);

    const res = await request(app)
      .post(rutaDeCreacion(project.id))
      .set('Cookie', cookie)
      .send({ title: 'El usuario externo no puede crear' });

    expect(res.status).toBe(403);
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(0);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.itemCounter).toBe(0);
    expect(await prisma.activityLog.count({ where: { projectId: project.id } })).toBe(0);
  });

  it('requiere una sesion valida antes de crear', async () => {
    const { project } = await createProject({ key: 'MIR' });

    const res = await request(app)
      .post(rutaDeCreacion(project.id))
      .send({ title: 'No hay sesion' });

    expect(res.status).toBe(401);
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(0);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.itemCounter).toBe(0);
    expect(await prisma.activityLog.count({ where: { projectId: project.id } })).toBe(0);
  });

  it('rechaza un titulo invalido antes de modificar el proyecto', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .post(rutaDeCreacion(project.id))
      .set('Cookie', cookie)
      .send({ title: 'No' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(0);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.itemCounter).toBe(0);
    expect(await prisma.activityLog.count({ where: { projectId: project.id } })).toBe(0);
  });

  it('asigna referencias distintas en dos creaciones simultaneas', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const member = await createUser({ email: 'member@mira.test' });
    await addMember(project, member, 'MEMBER');
    const [ownerCookie, memberCookie] = await Promise.all([
      iniciarSesion(owner),
      iniciarSesion(member),
    ]);

    const [first, second] = await Promise.all([
      request(app)
        .post(rutaDeCreacion(project.id))
        .set('Cookie', ownerCookie)
        .send({ title: 'Creacion concurrente del owner' }),
      request(app)
        .post(rutaDeCreacion(project.id))
        .set('Cookie', memberCookie)
        .send({ title: 'Creacion concurrente del member' }),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect([first.body.item.reference, second.body.item.reference].sort()).toEqual([
      'MIR-1',
      'MIR-2',
    ]);

    const [items, updatedProject, activities] = await Promise.all([
      prisma.workItem.findMany({ where: { projectId: project.id }, orderBy: { reference: 'asc' } }),
      prisma.project.findUnique({ where: { id: project.id } }),
      prisma.activityLog.findMany({ where: { projectId: project.id, action: 'ITEM_CREATED' } }),
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.reference)).toEqual(['MIR-1', 'MIR-2']);
    expect(new Set(items.map((item) => item.reference)).size).toBe(2);
    expect(updatedProject?.itemCounter).toBe(2);
    expect(activities).toHaveLength(2);
    expect(new Set(activities.map((activity) => activity.workItemId))).toEqual(
      new Set(items.map((item) => item.id)),
    );
  });
});
