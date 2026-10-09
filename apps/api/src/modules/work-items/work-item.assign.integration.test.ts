import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  addMember,
  createProject,
  createUser,
  createWorkItem,
  sessionCookie,
} from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * MIR-17: asignar un responsable.
 *
 * Criterios: asignar a un miembro lo deja como responsable y registra
 * ITEM_ASSIGNED; un no miembro da 400; quitar el responsable lo deja sin
 * asignar; el backlog filtra por responsable.
 *
 * Requiere:  npm run db:up
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

const rutaAsignar = (projectId: string, workItemId: string) =>
  `/api/projects/${projectId}/work-items/${workItemId}/assignee`;

describe('PATCH /api/projects/:projectId/work-items/:workItemId/assignee', () => {
  it('CA1: asignar a un miembro lo deja como responsable y registra ITEM_ASSIGNED', async () => {
    const { project, owner } = await createProject();
    const grace = await createUser({ name: 'Grace Hopper' });
    await addMember(project, grace, 'MEMBER');
    const item = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: grace.id });

    expect(res.status).toBe(200);
    expect(res.body.item.assignee).toMatchObject({ id: grace.id, name: 'Grace Hopper' });

    const guardado = await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(guardado.assigneeId).toBe(grace.id);

    const actividad = await prisma.activityLog.findMany({
      where: { workItemId: item.id, action: 'ITEM_ASSIGNED' },
    });
    expect(actividad).toHaveLength(1);
    expect(actividad[0]).toMatchObject({
      actorId: owner.id,
      field: 'assigneeId',
      fromValue: null,
      toValue: grace.id,
    });
  });

  it('un VIEWER tambien puede ser responsable', async () => {
    const { project, owner } = await createProject();
    const viewer = await createUser();
    await addMember(project, viewer, 'VIEWER');
    const item = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: viewer.id });

    expect(res.status).toBe(200);
    expect(res.body.item.assignee.id).toBe(viewer.id);
  });

  it('CA2: asignar a quien no es miembro responde 400 y no cambia nada', async () => {
    const { project, owner } = await createProject();
    const extrano = await createUser();
    const item = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: extrano.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ASSIGNEE_NOT_MEMBER');
    const guardado = await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(guardado.assigneeId).toBeNull();
    expect(await prisma.activityLog.count({ where: { action: 'ITEM_ASSIGNED' } })).toBe(0);
  });

  it('CA3: quitar el responsable deja el item sin asignar y lo registra', async () => {
    const { project, owner } = await createProject();
    const grace = await createUser();
    await addMember(project, grace, 'MEMBER');
    const item = await createWorkItem({ project, createdBy: owner, assigneeId: grace.id });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: null });

    expect(res.status).toBe(200);
    expect(res.body.item.assignee).toBeNull();
    const actividad = await prisma.activityLog.findFirstOrThrow({
      where: { workItemId: item.id, action: 'ITEM_ASSIGNED' },
    });
    expect(actividad).toMatchObject({ fromValue: grace.id, toValue: null });
  });

  it('asignar al responsable actual no registra historial', async () => {
    const { project, owner } = await createProject();
    const grace = await createUser();
    await addMember(project, grace, 'MEMBER');
    const item = await createWorkItem({ project, createdBy: owner, assigneeId: grace.id });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: grace.id });

    expect(res.status).toBe(200);
    expect(await prisma.activityLog.count({ where: { action: 'ITEM_ASSIGNED' } })).toBe(0);
  });

  it('CA4: el backlog filtrado por responsable muestra solo sus items', async () => {
    const { project, owner } = await createProject();
    const grace = await createUser();
    await addMember(project, grace, 'MEMBER');
    const deGrace = await createWorkItem({ project, createdBy: owner, title: 'De Grace' });
    await createWorkItem({ project, createdBy: owner, title: 'Sin responsable' });

    await request(app)
      .patch(rutaAsignar(project.id, deGrace.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: grace.id });

    const res = await request(app)
      .get(`/api/projects/${project.id}/work-items?assigneeId=${grace.id}`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { title: string }) => i.title)).toEqual(['De Grace']);
  });

  it('un VIEWER no puede asignar: 403', async () => {
    const { project, owner } = await createProject();
    const viewer = await createUser();
    await addMember(project, viewer, 'VIEWER');
    const item = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(viewer))
      .send({ assigneeId: owner.id });

    expect(res.status).toBe(403);
  });

  it('rechaza campos ajenos a la asignacion con 422', async () => {
    const { project, owner } = await createProject();
    const item = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .patch(rutaAsignar(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ assigneeId: null, title: 'otro' });

    expect(res.status).toBe(422);
  });
});
