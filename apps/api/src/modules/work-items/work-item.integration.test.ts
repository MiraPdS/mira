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
import { createWorkItemService } from './work-item.service.js';

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

describe('DELETE /api/projects/:projectId/work-items/:workItemId', () => {
  it.each(['OWNER', 'MEMBER'] as const)('%s elimina y recibe 204 sin body', async (role) => {
    const { project, owner } = await createProject();
    const actor = role === 'OWNER' ? owner : await createUser();
    if (role === 'MEMBER') await addMember(project, actor, role);
    const workItem = await createWorkItem({ project, createdBy: owner });
    const cookie = await iniciarSesion(actor);

    const res = await request(app)
      .delete(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await prisma.workItem.findUnique({ where: { id: workItem.id } })).toBeNull();
    const detail = await request(app)
      .get(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);
    expect(detail.status).toBe(404);
    const backlog = await request(app).get(rutaDeCreacion(project.id)).set('Cookie', cookie);
    expect(backlog.status).toBe(200);
    expect(backlog.body).toMatchObject({ data: [], total: 0 });
    expect(await prisma.activityLog.findMany({ where: { action: 'ITEM_DELETED' } })).toEqual([
      expect.objectContaining({
        projectId: project.id,
        actorId: actor.id,
        workItemId: null,
        field: 'reference',
        fromValue: workItem.reference,
        toValue: null,
      }),
    ]);
  });

  it('elimina comentarios por cascada y conserva el historial previo y de eliminacion', async () => {
    const { project, owner } = await createProject();
    const workItem = await createWorkItem({ project, createdBy: owner });
    const otherItem = await createWorkItem({ project, createdBy: owner });
    await prisma.comment.createMany({
      data: [
        { workItemId: workItem.id, authorId: owner.id, body: 'Comentario uno' },
        { workItemId: workItem.id, authorId: owner.id, body: 'Comentario dos' },
        { workItemId: otherItem.id, authorId: owner.id, body: 'Comentario de otro item' },
      ],
    });
    const previous = await prisma.activityLog.create({
      data: {
        projectId: project.id,
        workItemId: workItem.id,
        actorId: owner.id,
        action: 'ITEM_UPDATED',
        field: 'title',
        fromValue: 'Titulo anterior',
        toValue: workItem.title,
      },
    });
    const cookie = await iniciarSesion(owner);

    await request(app)
      .delete(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie)
      .expect(204);

    expect(await prisma.comment.count({ where: { workItemId: workItem.id } })).toBe(0);
    expect(await prisma.comment.count({ where: { workItemId: otherItem.id } })).toBe(1);
    expect(await prisma.workItem.findUnique({ where: { id: otherItem.id } })).not.toBeNull();
    expect(await prisma.activityLog.findUnique({ where: { id: previous.id } })).toEqual({
      ...previous,
      workItemId: null,
    });
    const history = await prisma.activityLog.findMany({ where: { projectId: project.id } });
    expect(history).toHaveLength(2);
    expect(history).toContainEqual(
      expect.objectContaining({
        action: 'ITEM_DELETED',
        actorId: owner.id,
        workItemId: null,
        field: 'reference',
        fromValue: workItem.reference,
        toValue: null,
      }),
    );
  });

  it('rechaza VIEWER con 403 sin borrar item, comentarios ni crear historial', async () => {
    const { project, owner } = await createProject();
    const viewer = await createUser();
    await addMember(project, viewer, 'VIEWER');
    const workItem = await createWorkItem({ project, createdBy: owner });
    const comment = await prisma.comment.create({
      data: { workItemId: workItem.id, authorId: owner.id, body: 'Conservar comentario' },
    });
    const cookie = await iniciarSesion(viewer);

    const res = await request(app)
      .delete(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(await prisma.workItem.findUnique({ where: { id: workItem.id } })).not.toBeNull();
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).not.toBeNull();
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('oculta el item al no miembro con 404 como en el detalle', async () => {
    const { project, owner } = await createProject();
    const outsider = await createUser();
    const workItem = await createWorkItem({ project, createdBy: owner });
    const cookie = await iniciarSesion(outsider);

    const res = await request(app)
      .delete(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.workItem.findUnique({ where: { id: workItem.id } })).not.toBeNull();
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('requiere sesion valida y responde 401 sin efectos secundarios', async () => {
    const { project, owner } = await createProject();
    const workItem = await createWorkItem({ project, createdBy: owner });

    const res = await request(app).delete(rutaDeDetalle(project.id, workItem.id));

    expect(res.status).toBe(401);
    expect(await prisma.workItem.findUnique({ where: { id: workItem.id } })).not.toBeNull();
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('responde 404 para un item inexistente sin crear historial', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .delete(rutaDeDetalle(project.id, 'item_inexistente'))
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('responde 404 para un item de otro proyecto aunque el actor sea OWNER en ambos', async () => {
    const { project, owner } = await createProject();
    const { project: otherProject } = await createProject({ owner });
    const workItem = await createWorkItem({ project: otherProject, createdBy: owner });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .delete(rutaDeDetalle(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.workItem.findUnique({ where: { id: workItem.id } })).not.toBeNull();
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('revierte ITEM_DELETED si PostgreSQL falla al borrar el item', async () => {
    const { project, owner } = await createProject();
    const workItem = await createWorkItem({ project, createdBy: owner });
    const comment = await prisma.comment.create({
      data: { workItemId: workItem.id, authorId: owner.id, body: 'No debe perderse' },
    });
    const previous = await prisma.activityLog.create({
      data: {
        projectId: project.id,
        workItemId: workItem.id,
        actorId: owner.id,
        action: 'ITEM_CREATED',
      },
    });

    // El trigger fuerza un fallo real DESPUES de insertar el log. Tanto el
    // trigger como su funcion son DDL transaccional y desaparecen al revertir.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          CREATE FUNCTION mir16_reject_delete() RETURNS trigger LANGUAGE plpgsql AS
          $$ BEGIN RAISE EXCEPTION 'MIR16_DELETE_BLOCKED'; END; $$
        `;
        await tx.$executeRaw`
          CREATE TRIGGER mir16_reject_delete BEFORE DELETE ON work_items
          FOR EACH ROW EXECUTE FUNCTION mir16_reject_delete()
        `;
        const service = createWorkItemService(createWorkItemRepository(tx));
        await service.delete(project.id, owner.id, workItem.id);
      }),
    ).rejects.toThrow('MIR16_DELETE_BLOCKED');

    expect(await prisma.workItem.findUnique({ where: { id: workItem.id } })).not.toBeNull();
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).not.toBeNull();
    expect(await prisma.activityLog.findUnique({ where: { id: previous.id } })).toEqual(previous);
    expect(await prisma.activityLog.count({ where: { action: 'ITEM_DELETED' } })).toBe(0);
  });
});

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

  it('busca en titulo y descripcion sin distinguir mayusculas', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const [titleMatch, descriptionMatch] = await Promise.all([
      createWorkItem({
        project,
        createdBy: owner,
        title: 'Corregir LOGIN de usuarios',
        description: 'Sin coincidencias en la descripcion.',
      }),
      createWorkItem({
        project,
        createdBy: owner,
        title: 'Actualizar documentacion',
        description: 'Explicar el flujo de login para miembros.',
      }),
      createWorkItem({
        project,
        createdBy: owner,
        title: 'Preparar retrospectiva',
        description: 'Sin coincidencias.',
      }),
    ]);
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?q=LoGiN`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([titleMatch.id, descriptionMatch.id]),
    );
  });

  it('aplica cada filtro de enum y de responsable', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const assignee = await createUser({ email: 'assignee@mira.test' });
    await addMember(project, assignee);
    const [bug, inProgress, highPriority, assigned] = await Promise.all([
      createWorkItem({ project, createdBy: owner, title: 'Error reproducible', type: 'BUG' }),
      createWorkItem({
        project,
        createdBy: owner,
        title: 'En ejecucion',
        status: 'IN_PROGRESS',
      }),
      createWorkItem({ project, createdBy: owner, title: 'Urgente', priority: 'HIGH' }),
      createWorkItem({ project, createdBy: owner, title: 'Asignado', assigneeId: assignee.id }),
    ]);
    const cookie = await iniciarSesion(owner);

    const [byType, byStatus, byPriority, byAssignee] = await Promise.all([
      request(app)
        .get(`${rutaDeCreacion(project.id)}?type=BUG`)
        .set('Cookie', cookie),
      request(app)
        .get(`${rutaDeCreacion(project.id)}?status=IN_PROGRESS`)
        .set('Cookie', cookie),
      request(app)
        .get(`${rutaDeCreacion(project.id)}?priority=HIGH`)
        .set('Cookie', cookie),
      request(app)
        .get(`${rutaDeCreacion(project.id)}?assigneeId=${assignee.id}`)
        .set('Cookie', cookie),
    ]);

    expect(byType.status).toBe(200);
    expect(byType.body).toMatchObject({ total: 1 });
    expect(byType.body.data).toHaveLength(1);
    expect(byType.body.data[0].id).toBe(bug.id);

    expect(byStatus.status).toBe(200);
    expect(byStatus.body).toMatchObject({ total: 1 });
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].id).toBe(inProgress.id);

    expect(byPriority.status).toBe(200);
    expect(byPriority.body).toMatchObject({ total: 1 });
    expect(byPriority.body.data).toHaveLength(1);
    expect(byPriority.body.data[0].id).toBe(highPriority.id);

    expect(byAssignee.status).toBe(200);
    expect(byAssignee.body).toMatchObject({ total: 1 });
    expect(byAssignee.body.data).toHaveLength(1);
    expect(byAssignee.body.data[0].id).toBe(assigned.id);
  });

  it('combina busqueda y filtros con AND, y cuenta solo los resultados filtrados', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const matching = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Corregir login',
      type: 'BUG',
      priority: 'HIGH',
    });
    await Promise.all([
      createWorkItem({
        project,
        createdBy: owner,
        title: 'Corregir login secundario',
        type: 'BUG',
        priority: 'LOW',
      }),
      createWorkItem({
        project,
        createdBy: owner,
        title: 'Mejorar login',
        type: 'TASK',
        priority: 'HIGH',
      }),
      createWorkItem({
        project,
        createdBy: owner,
        title: 'Corregir permisos',
        type: 'BUG',
        priority: 'HIGH',
      }),
    ]);
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?q=login&type=BUG&priority=HIGH`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(matching.id);
  });

  it('pagina despues de filtrar y devuelve una lista vacia si no hay coincidencias', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    await Promise.all([
      ...Array.from({ length: 5 }, (_, index) =>
        createWorkItem({
          project,
          createdBy: owner,
          title: `Bug filtrado ${index}`,
          type: 'BUG',
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        createWorkItem({
          project,
          createdBy: owner,
          title: `Tarea fuera del filtro ${index}`,
          type: 'TASK',
        }),
      ),
    ]);
    const cookie = await iniciarSesion(owner);

    const paged = await request(app)
      .get(`${rutaDeCreacion(project.id)}?type=BUG&page=2&pageSize=2`)
      .set('Cookie', cookie);
    const empty = await request(app)
      .get(`${rutaDeCreacion(project.id)}?q=inexistente`)
      .set('Cookie', cookie);

    expect(paged.status).toBe(200);
    expect(paged.body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
    expect(paged.body.data).toHaveLength(2);
    expect(paged.body.data.every((item: { type: string }) => item.type === 'BUG')).toBe(true);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ data: [], page: 1, pageSize: 20, total: 0 });
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

  it.each(['type=FEATURE', 'status=UNKNOWN', 'priority=URGENT'])(
    'rechaza un filtro invalido: %s',
    async (query) => {
      const owner = await createUser({ email: 'owner@mira.test' });
      const { project } = await createProject({ owner, key: 'MIR' });
      const cookie = await iniciarSesion(owner);

      const res = await request(app)
        .get(`${rutaDeCreacion(project.id)}?${query}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

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

  it('no devuelve coincidencias filtradas de otro proyecto', async () => {
    const owner = await createUser({ email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const { project: otherProject } = await createProject({ owner, key: 'OTR' });
    const item = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Login del proyecto actual',
      type: 'BUG',
    });
    await createWorkItem({
      project: otherProject,
      createdBy: owner,
      title: 'Login del otro proyecto',
      type: 'BUG',
    });
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(`${rutaDeCreacion(project.id)}?q=login&type=BUG`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(item.id);
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
