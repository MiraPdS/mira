import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../lib/prisma.js';
import {
  addMember,
  createProject,
  columnIdOfStatus,
  createSprint,
  createUser,
  createWorkItem,
  sessionCookie,
} from '../../test/factories.js';

let app: Express;
beforeAll(async () => {
  app = (await import('../../app.js')).createApp();
});
const route = (projectId: string, itemId: string) =>
  `/api/projects/${projectId}/work-items/${itemId}/sprint`;

describe('MIR-45 asignacion e historial', () => {
  it.each(['PLANNED', 'ACTIVE'] as const)(
    'persiste destino %s y registra IDs, pero muestra nombres',
    async (status) => {
      const { project, owner } = await createProject();
      const sprint = await createSprint({ project, status, name: 'Entrega API' });
      const column = await prisma.boardColumn.findFirstOrThrow({
        where: { projectId: project.id },
      });
      const item = await createWorkItem({
        project,
        createdBy: owner,
        estimate: 5,
        columnId: column.id,
      });
      const res = await request(app)
        .patch(route(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ sprintId: sprint.id });
      expect(res.status).toBe(200);
      expect(res.body.item.sprintId).toBe(sprint.id);
      expect(res.body.item).toMatchObject({
        columnId: column.id,
        column: { id: column.id, name: column.name, category: column.category },
      });
      expect((await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).sprintId).toBe(
        sprint.id,
      );
      expect(await prisma.activityLog.findMany()).toEqual([
        expect.objectContaining({
          action: 'ITEM_UPDATED',
          field: 'sprintId',
          workItemId: item.id,
          actorId: owner.id,
          fromValue: null,
          toValue: sprint.id,
        }),
      ]);
      const history = await request(app)
        .get(`/api/projects/${project.id}/work-items/${item.id}/activity`)
        .set('Cookie', sessionCookie(owner));
      expect(history.status).toBe(200);
      expect(history.body.data[0]).toMatchObject({
        fromValue: null,
        toValue: 'Entrega API',
        field: 'sprintId',
      });
      const summary = await request(app)
        .get(`/api/projects/${project.id}/summary`)
        .set('Cookie', sessionCookie(owner));
      expect(summary.body.summary.recentActivity[0].toValue).toBe('Entrega API');
      const list = await request(app)
        .get(`/api/projects/${project.id}/sprints`)
        .set('Cookie', sessionCookie(owner));
      expect(list.body.data[0]).toMatchObject({ items: 1, points: 5 });
      await prisma.sprint.delete({ where: { id: sprint.id } });
      const deletedHistory = await request(app)
        .get(`/api/projects/${project.id}/work-items/${item.id}/activity`)
        .set('Cookie', sessionCookie(owner));
      expect(deletedHistory.body.data[0].toValue).toBe('Sprint eliminado');
    },
  );
  it.each(['OWNER', 'MEMBER', 'VIEWER', 'OUTSIDER', 'ANONYMOUS'] as const)(
    'permisos de %s',
    async (role) => {
      const { project, owner } = await createProject();
      const actor = role === 'OWNER' ? owner : await createUser();
      if (role === 'MEMBER' || role === 'VIEWER') await addMember(project, actor, role);
      const item = await createWorkItem({ project, createdBy: owner });
      const sprint = await createSprint({ project });
      const req = request(app).patch(route(project.id, item.id));
      if (role !== 'ANONYMOUS') req.set('Cookie', sessionCookie(actor));
      const res = await req.send({ sprintId: sprint.id });
      const expected = { OWNER: 200, MEMBER: 200, VIEWER: 403, OUTSIDER: 404, ANONYMOUS: 401 }[
        role
      ];
      expect(res.status).toBe(expected);
      if (expected !== 200) {
        expect(
          (await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).sprintId,
        ).toBeNull();
        expect(await prisma.activityLog.count()).toBe(0);
      }
    },
  );
  it.each([false, true])('CLOSED da 409, incluido mismo destino: %s', async (alreadyAssigned) => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project, status: 'CLOSED' });
    const item = await createWorkItem({
      project,
      createdBy: owner,
      sprintId: alreadyAssigned ? sprint.id : null,
    });
    const res = await request(app)
      .patch(route(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ sprintId: sprint.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SPRINT_CLOSED');
    expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
    expect(await prisma.activityLog.count()).toBe(0);
  });
  it('reemplaza y quita desde CLOSED; no duplica cambios iguales', async () => {
    const { project, owner } = await createProject();
    const closed = await createSprint({ project, status: 'CLOSED' });
    const active = await createSprint({ project, status: 'ACTIVE' });
    const item = await createWorkItem({ project, createdBy: owner, sprintId: closed.id });
    const patch = (sprintId: string | null) =>
      request(app)
        .patch(route(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ sprintId });
    expect((await patch(null)).status).toBe(200);
    expect((await patch(null)).status).toBe(200);
    expect((await patch(active.id)).status).toBe(200);
    expect((await patch(active.id)).status).toBe(200);
    const events = await prisma.activityLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(events.map(({ fromValue, toValue }) => [fromValue, toValue])).toEqual([
      [closed.id, null],
      [null, active.id],
    ]);
  });
  it.each(['item', 'sprint'] as const)('%s de otro proyecto da 400', async (target) => {
    const { project, owner } = await createProject();
    const other = await createProject({ owner });
    const item = await createWorkItem({
      project: target === 'item' ? other.project : project,
      createdBy: owner,
    });
    const sprint = await createSprint({ project: target === 'sprint' ? other.project : project });
    const res = await request(app)
      .patch(route(project.id, item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ sprintId: sprint.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(
      target === 'item' ? 'WORK_ITEM_PROJECT_MISMATCH' : 'SPRINT_PROJECT_MISMATCH',
    );
    expect(await prisma.activityLog.count()).toBe(0);
    expect(
      (await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).sprintId,
    ).toBeNull();
  });
  it.each(['item', 'sprint'] as const)('%s inexistente da 404', async (target) => {
    const { project, owner } = await createProject();
    const item = await createWorkItem({ project, createdBy: owner });
    const sprint = await createSprint({ project });
    const res = await request(app)
      .patch(route(project.id, target === 'item' ? 'missing' : item.id))
      .set('Cookie', sessionCookie(owner))
      .send({ sprintId: target === 'sprint' ? 'missing' : sprint.id });
    expect(res.status).toBe(404);
    expect(await prisma.activityLog.count()).toBe(0);
  });
  it.each([{}, { sprintId: '' }, { sprintId: null, columnId: 'column_done' }])(
    'rechaza contrato invalido %j',
    async (input) => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner });
      expect(
        (
          await request(app)
            .patch(route(project.id, item.id))
            .set('Cookie', sessionCookie(owner))
            .send(input)
        ).status,
      ).toBe(422);
      expect(await prisma.activityLog.count()).toBe(0);
    },
  );
  it('revierte la asignacion si falla el registro del historial', async () => {
    const { project, owner } = await createProject();
    const item = await createWorkItem({ project, createdBy: owner });
    const sprint = await createSprint({ project });
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION mir45_fail_activity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.field = 'sprintId' THEN RAISE EXCEPTION 'MIR45_ACTIVITY_BLOCKED'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER mir45_fail_activity BEFORE INSERT ON activity_log FOR EACH ROW EXECUTE FUNCTION mir45_fail_activity()`,
    );
    try {
      const res = await request(app)
        .patch(route(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ sprintId: sprint.id });
      expect(res.status).toBe(500);
      expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
      expect(await prisma.activityLog.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER mir45_fail_activity ON activity_log');
      await prisma.$executeRawUnsafe('DROP FUNCTION mir45_fail_activity()');
    }
  });
  it('dos asignaciones concurrentes dejan historial encadenado', async () => {
    const { project, owner } = await createProject();
    const item = await createWorkItem({ project, createdBy: owner });
    const a = await createSprint({ project });
    const b = await createSprint({ project });
    const responses = await Promise.all(
      [a, b].map((sprint) =>
        request(app)
          .patch(route(project.id, item.id))
          .set('Cookie', sessionCookie(owner))
          .send({ sprintId: sprint.id }),
      ),
    );
    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    const events = await prisma.activityLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(events).toHaveLength(2);
    expect(events[0]!.fromValue).toBeNull();
    expect(events[1]!.fromValue).toBe(events[0]!.toValue);
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).sprintId).toBe(
      events[1]!.toValue,
    );
  });
});

describe('MIR-45 filtros de backlog', () => {
  it('combina sprint/sin sprint con busqueda, columna y paginacion, sin mezclar proyectos', async () => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project });
    const columnId = await columnIdOfStatus(project, 'TODO');
    const doneColumnId = await columnIdOfStatus(project, 'DONE');
    const other = await createProject({ owner });
    const foreign = await createSprint({ project: other.project });
    for (let i = 0; i < 3; i++)
      await createWorkItem({
        project,
        createdBy: owner,
        title: `API ${i}`,
        columnId,
        sprintId: sprint.id,
      });
    await createWorkItem({ project, createdBy: owner, title: 'API libre', columnId });
    await createWorkItem({
      project,
      createdBy: owner,
      title: 'API hecha',
      columnId: doneColumnId,
      sprintId: sprint.id,
    });
    await createWorkItem({
      project: other.project,
      createdBy: owner,
      title: 'API ajena',
      columnId: await columnIdOfStatus(other.project, 'TODO'),
      sprintId: foreign.id,
    });
    const list = (sprintId?: string, page = 1) =>
      request(app)
        .get(`/api/projects/${project.id}/work-items`)
        .query({ q: 'API', columnId, pageSize: 2, page, ...(sprintId ? { sprintId } : {}) })
        .set('Cookie', sessionCookie(owner));
    const assigned = await list(sprint.id);
    expect(assigned.status).toBe(200);
    expect(assigned.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(assigned.body.data).toHaveLength(2);
    expect(
      assigned.body.data.every((item: { sprintId: string }) => item.sprintId === sprint.id),
    ).toBe(true);
    expect((await list(sprint.id, 2)).body.data).toHaveLength(1);
    expect((await list('none')).body).toMatchObject({
      total: 1,
      data: [expect.objectContaining({ sprintId: null })],
    });
    expect((await list()).body.total).toBe(4);
    for (const id of [foreign.id, 'missing'])
      expect((await list(id)).body).toMatchObject({ total: 0, data: [] });
  });
});
