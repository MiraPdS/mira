import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { User } from '@prisma/client';
import {
  addMember,
  createProject,
  createUser,
  createWorkItem,
  PASSWORD_DE_PRUEBA,
} from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';
import { createWorkItemRepository } from './work-item.repository.js';

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

function rutaDeDetalle(projectId: string, workItemId: string): string {
  return `/api/projects/${projectId}/work-items/${workItemId}`;
}

async function crearItems(projectId: string, createdBy: User, cantidad: number): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await Promise.all(
    Array.from({ length: cantidad }, (_, index) =>
      createWorkItem({
        project,
        createdBy,
        title: `Item de backlog ${index + 1}`,
      }),
    ),
  );
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

describe('GET /api/projects/:projectId/work-items', () => {
  it('devuelve la primera pagina de 20 items y el total de 25', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await crearItems(project.id, owner, 25);
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?page=1&pageSize=20`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 25 });
    expect(res.body.data).toHaveLength(20);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ projectId: project.id })]),
    );
    expect(
      res.body.data.every((item: { projectId: string }) => item.projectId === project.id),
    ).toBe(true);
  });

  it('devuelve los cinco items restantes en la segunda pagina', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await crearItems(project.id, owner, 25);
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?page=2&pageSize=20`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, pageSize: 20, total: 25 });
    expect(res.body.data).toHaveLength(5);
  });

  it('aplica page=1 y pageSize=20 cuando no se envia query', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await crearItems(project.id, owner, 21);
    const cookie = await iniciarSesion(owner);

    const res = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 21 });
    expect(res.body.data).toHaveLength(20);
  });

  it('devuelve un backlog vacio para un proyecto miembro sin items', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const cookie = await iniciarSesion(owner);

    const res = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], page: 1, pageSize: 20, total: 0 });
  });

  it('permite a VIEWER listar el backlog', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await crearItems(project.id, owner, 1);
    const viewer = await createUser({ email: 'viewer@mira.test' });
    await addMember(project, viewer, 'VIEWER');
    const cookie = await iniciarSesion(viewer);

    const res = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data).toHaveLength(1);
  });

  it('rechaza a un usuario autenticado que no pertenece al proyecto', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await crearItems(project.id, owner, 1);
    const outsider = await createUser({ email: 'outsider@mira.test' });
    const cookie = await iniciarSesion(outsider);

    const res = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('data');
  });

  it('requiere una sesion valida para listar', async () => {
    const { project } = await createProject({ key: 'MIR' });

    const res = await request(app).get(rutaDeCreacion(project.id));

    expect(res.status).toBe(401);
  });

  it.each(['0', 'abc'])('rechaza page=%s', async (page) => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?page=${page}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza pageSize mayor a 100', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?pageSize=101`)
      .set('Cookie', cookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ordena por createdAt DESC y desempata por id DESC', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const [oldest, tiedFirst, tiedSecond, newest] = await Promise.all([
      createWorkItem({ project, createdBy: owner }),
      createWorkItem({ project, createdBy: owner }),
      createWorkItem({ project, createdBy: owner }),
      createWorkItem({ project, createdBy: owner }),
    ]);
    const sharedCreatedAt = new Date('2026-03-02T10:00:00.000Z');
    await Promise.all([
      prisma.workItem.update({
        where: { id: oldest.id },
        data: { createdAt: new Date('2026-03-01T10:00:00.000Z') },
      }),
      prisma.workItem.update({ where: { id: tiedFirst.id }, data: { createdAt: sharedCreatedAt } }),
      prisma.workItem.update({
        where: { id: tiedSecond.id },
        data: { createdAt: sharedCreatedAt },
      }),
      prisma.workItem.update({
        where: { id: newest.id },
        data: { createdAt: new Date('2026-03-03T10:00:00.000Z') },
      }),
    ]);
    const cookie = await iniciarSesion(owner);

    const res = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual([
      newest.id,
      ...[tiedFirst.id, tiedSecond.id].sort().reverse(),
      oldest.id,
    ]);
  });

  it('aísla items y total al proyecto solicitado', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const { project: otherProject } = await createProject({ owner, key: 'OTR' });
    await crearItems(project.id, owner, 2);
    await crearItems(otherProject.id, owner, 3);
    const cookie = await iniciarSesion(owner);

    const res = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(
      res.body.data.every((item: { projectId: string }) => item.projectId === project.id),
    ).toBe(true);
  });

  it('devuelve una pagina vacia fuera de rango sin convertirla en 404', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await crearItems(project.id, owner, 5);
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?page=50&pageSize=20`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], page: 50, pageSize: 20, total: 5 });
  });
});

describe('GET /api/projects/:projectId/work-items/:workItemId', () => {
  it('permite a MEMBER obtener el detalle completo', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const member = await createUser({ email: 'member@mira.test' });
    const assignee = await createUser({ email: 'assignee@mira.test' });
    await addMember(project, member, 'MEMBER');
    await addMember(project, assignee, 'MEMBER');
    const dueDate = new Date('2026-03-15T12:00:00.000Z');
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Preparar la primera entrega',
      description: 'Implementar el detalle del elemento.',
      type: 'STORY',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimate: 5,
      dueDate,
      assigneeId: assignee.id,
    });
    const cookie = await iniciarSesion(member);

    const res = await request(app)
      .get(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.item).toEqual({
      id: workItem.id,
      reference: workItem.reference,
      projectId: project.id,
      title: 'Preparar la primera entrega',
      description: 'Implementar el detalle del elemento.',
      type: 'STORY',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimate: 5,
      dueDate: dueDate.toISOString(),
      assignee: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
        createdAt: assignee.createdAt.toISOString(),
      },
      createdBy: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        createdAt: owner.createdAt.toISOString(),
      },
      sprintId: null,
      createdAt: workItem.createdAt.toISOString(),
      updatedAt: workItem.updatedAt.toISOString(),
    });
  });

  it.each(['OWNER', 'VIEWER'] as const)('%s puede obtener el detalle', async (role) => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const actor = role === 'OWNER' ? owner : await createUser({ email: 'viewer@mira.test' });
    if (role === 'VIEWER') await addMember(project, actor, 'VIEWER');
    const workItem = await createWorkItem({ project, createdBy: owner });
    const cookie = await iniciarSesion(actor);

    const res = await request(app)
      .get(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe(workItem.id);
  });

  it('oculta el item a un usuario autenticado que no es miembro', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const outsider = await createUser({ email: 'outsider@mira.test' });
    const workItem = await createWorkItem({ project, createdBy: owner });
    const cookie = await iniciarSesion(outsider);

    const res = await request(app)
      .get(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Elemento de trabajo no encontrado',
    });
  });

  it('responde 404 para un item inexistente o de otro proyecto', async () => {
    const actor = await createUser({ email: 'actor@mira.test' });
    const { project: projectA } = await createProject({ owner: actor, key: 'PA' });
    const ownerB = await createUser({ email: 'owner-b@mira.test' });
    const { project: projectB } = await createProject({ owner: ownerB, key: 'PB' });
    const workItemB = await createWorkItem({ project: projectB, createdBy: ownerB });
    const cookie = await iniciarSesion(actor);

    for (const workItemId of ['work_item_inexistente', workItemB.id]) {
      const res = await request(app)
        .get(rutaDeDetalle(projectA.id, workItemId))
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('requiere una sesion valida y conserva los campos nullable', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      description: null,
      estimate: null,
      dueDate: null,
      assigneeId: null,
    });

    const withoutSession = await request(app).get(rutaDeDetalle(project.id, workItem.id));
    expect(withoutSession.status).toBe(401);

    const cookie = await iniciarSesion(owner);
    const res = await request(app)
      .get(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({
      description: null,
      estimate: null,
      dueDate: null,
      assignee: null,
    });
  });
});

describe('PATCH /api/projects/:projectId/work-items/:workItemId', () => {
  it('permite a MEMBER cambiar el titulo, persiste y registra ITEM_UPDATED', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const member = await createUser({ email: 'member@mira.test' });
    await addMember(project, member, 'MEMBER');
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Titulo original',
    });
    const cookie = await iniciarSesion(member);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ title: 'Titulo actualizado' });

    expect(res.status).toBe(200);
    expect(res.body.item.title).toBe('Titulo actualizado');

    const [updatedWorkItem, activities] = await Promise.all([
      prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } }),
      prisma.activityLog.findMany({ where: { workItemId: workItem.id } }),
    ]);
    expect(updatedWorkItem.title).toBe('Titulo actualizado');
    expect(activities).toEqual([
      expect.objectContaining({
        action: 'ITEM_UPDATED',
        actorId: member.id,
        field: 'title',
        fromValue: 'Titulo original',
        toValue: 'Titulo actualizado',
      }),
    ]);
  });

  it('permite a OWNER editar un item', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({ project, createdBy: owner, priority: 'MEDIUM' });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ priority: 'CRITICAL' });

    expect(res.status).toBe(200);
    expect(res.body.item.priority).toBe('CRITICAL');
  });

  it('conserva todos los demas campos en un PATCH de un solo campo', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const dueDate = new Date('2026-03-15T12:00:00.000Z');
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Titulo original',
      description: 'Descripcion original',
      type: 'STORY',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimate: 5,
      dueDate,
    });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ title: 'Solo cambia el titulo' });

    expect(res.status).toBe(200);
    expect(await prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } })).toMatchObject({
      title: 'Solo cambia el titulo',
      description: 'Descripcion original',
      type: 'STORY',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimate: 5,
      dueDate,
    });
  });

  it('crea una actividad por cada campo que cambia', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      description: 'Descripcion original',
      type: 'STORY',
      priority: 'HIGH',
      estimate: 5,
      dueDate: new Date('2026-03-15T12:00:00.000Z'),
    });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({
        description: 'Nueva descripcion',
        type: 'BUG',
        priority: 'LOW',
        estimate: 8,
        dueDate: '2026-04-01T09:00:00.000Z',
      });

    expect(res.status).toBe(200);
    const activities = await prisma.activityLog.findMany({
      where: { workItemId: workItem.id, action: 'ITEM_UPDATED' },
    });
    expect(activities).toHaveLength(5);
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'description',
          fromValue: 'Descripcion original',
          toValue: 'Nueva descripcion',
        }),
        expect.objectContaining({ field: 'type', fromValue: 'STORY', toValue: 'BUG' }),
        expect.objectContaining({ field: 'priority', fromValue: 'HIGH', toValue: 'LOW' }),
        expect.objectContaining({ field: 'estimate', fromValue: '5', toValue: '8' }),
        expect.objectContaining({
          field: 'dueDate',
          fromValue: '2026-03-15T12:00:00.000Z',
          toValue: '2026-04-01T09:00:00.000Z',
        }),
      ]),
    );
  });

  it('no crea historial ni escribe cuando recibe el mismo valor', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Titulo sin cambios',
    });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ title: 'Titulo sin cambios' });

    expect(res.status).toBe(200);
    expect(res.body.item.updatedAt).toBe(workItem.updatedAt.toISOString());
    expect(await prisma.activityLog.count({ where: { workItemId: workItem.id } })).toBe(0);
  });

  it('permite asignar null a los campos nullable y conserva null en el historial', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      description: 'Descripcion',
      estimate: 5,
      dueDate: new Date('2026-03-15T12:00:00.000Z'),
    });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ description: null, estimate: null, dueDate: null });

    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ description: null, estimate: null, dueDate: null });
    expect(
      await prisma.activityLog.findMany({
        where: { workItemId: workItem.id },
        select: { field: true, toValue: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { field: 'description', toValue: null },
        { field: 'estimate', toValue: null },
        { field: 'dueDate', toValue: null },
      ]),
    );
  });

  it('rechaza a VIEWER sin modificar el item ni crear historial', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const viewer = await createUser({ email: 'viewer@mira.test' });
    await addMember(project, viewer, 'VIEWER');
    const workItem = await createWorkItem({ project, createdBy: owner, title: 'Titulo original' });
    const cookie = await iniciarSesion(viewer);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ title: 'No deberia actualizarse' });

    expect(res.status).toBe(403);
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } })).title).toBe(
      'Titulo original',
    );
    expect(await prisma.activityLog.count({ where: { workItemId: workItem.id } })).toBe(0);
  });

  it('rechaza a un usuario que no es miembro', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const outsider = await createUser({ email: 'outsider@mira.test' });
    const workItem = await createWorkItem({ project, createdBy: owner, title: 'Titulo original' });
    const cookie = await iniciarSesion(outsider);

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ title: 'No deberia actualizarse' });

    expect(res.status).toBe(403);
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } })).title).toBe(
      'Titulo original',
    );
    expect(await prisma.activityLog.count({ where: { workItemId: workItem.id } })).toBe(0);
  });

  it('responde 404 para un item inexistente o que pertenece a otro proyecto', async () => {
    const actor = await createUser({ email: 'actor@mira.test' });
    const { project: projectA } = await createProject({ owner: actor, key: 'PA' });
    const ownerB = await createUser({ email: 'owner-b@mira.test' });
    const { project: projectB } = await createProject({ owner: ownerB, key: 'PB' });
    const workItemB = await createWorkItem({ project: projectB, createdBy: ownerB });
    const cookie = await iniciarSesion(actor);

    for (const workItemId of ['work_item_inexistente', workItemB.id]) {
      const res = await request(app)
        .patch(rutaDeDetalle(projectA.id, workItemId))
        .set('Cookie', cookie)
        .send({ title: 'No deberia actualizarse' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('requiere una sesion valida', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .patch(rutaDeDetalle(project.id, workItem.id))
      .send({ title: 'No hay sesion' });

    expect(res.status).toBe(401);
  });

  it.each([{ status: 'DONE' }, { title: 'No' }])(
    'rechaza cuerpos desconocidos o invalidos antes de modificar',
    async (input) => {
      const owner = await createUser({ email: 'owner@mira.test' });
      const { project } = await createProject({ owner, key: 'MIR' });
      const workItem = await createWorkItem({
        project,
        createdBy: owner,
        title: 'Titulo original',
      });
      const cookie = await iniciarSesion(owner);

      const res = await request(app)
        .patch(rutaDeDetalle(project.id, workItem.id))
        .set('Cookie', cookie)
        .send(input);

      expect(res.status).toBe(422);
      expect((await prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } })).title).toBe(
        'Titulo original',
      );
      expect(await prisma.activityLog.count({ where: { workItemId: workItem.id } })).toBe(0);
    },
  );

  it('revierte la actualizacion si no puede registrar el historial', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({ project, createdBy: owner, title: 'Titulo original' });
    const repository = createWorkItemRepository();

    await expect(
      repository.updateAtomically({
        projectId: project.id,
        workItemId: workItem.id,
        actorId: 'actor_inexistente',
        input: { title: 'Titulo que debe revertirse' },
        changes: [
          {
            field: 'title',
            fromValue: 'Titulo original',
            toValue: 'Titulo que debe revertirse',
          },
        ],
      }),
    ).rejects.toThrow();

    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } })).title).toBe(
      'Titulo original',
    );
    expect(await prisma.activityLog.count({ where: { workItemId: workItem.id } })).toBe(0);
  });
});
