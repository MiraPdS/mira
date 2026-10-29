import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { sprintListItemSchema, sprintSchema } from '@mira/shared';
import { prisma } from '../../lib/prisma.js';
import {
  addMember,
  createProject,
  createSprint,
  createUser,
  createWorkItem,
  sessionCookie,
} from '../../test/factories.js';

let app: Express;
beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

const input = { name: 'Sprint inicial', startDate: '2026-10-28', endDate: '2026-11-11' };
const base = (projectId: string) => `/api/projects/${projectId}/sprints`;

describe('API de sprints MIR-43', () => {
  it.each(['OWNER', 'MEMBER'] as const)('%s crea 201 PLANNED sin objetivo', async (role) => {
    const { project, owner } = await createProject();
    const actor = role === 'OWNER' ? owner : await createUser();
    if (role === 'MEMBER') await addMember(project, actor);
    const res = await request(app)
      .post(base(project.id))
      .set('Cookie', sessionCookie(actor))
      .send(input);
    expect(res.status).toBe(201);
    expect(sprintSchema.parse(res.body.sprint)).toMatchObject({
      ...input,
      projectId: project.id,
      goal: null,
      status: 'PLANNED',
    });
    const saved = await prisma.sprint.findUniqueOrThrow({ where: { id: res.body.sprint.id } });
    expect(saved.status).toBe('PLANNED');
    expect(saved.startDate.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    expect(saved.endDate.toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });

  it('crea con objetivo y normaliza los textos', async () => {
    const { project, owner } = await createProject();
    const res = await request(app)
      .post(base(project.id))
      .set('Cookie', sessionCookie(owner))
      .send({ ...input, name: '  Sprint inicial ', goal: '  Entregar API  ' });
    expect(res.status).toBe(201);
    expect(res.body.sprint).toMatchObject({ name: input.name, goal: 'Entregar API' });
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'VIEWER recibe 403 en %s sin cambios',
    async (method) => {
      const { project, owner } = await createProject();
      const viewer = await createUser();
      await addMember(project, viewer, 'VIEWER');
      const sprint = await createSprint({ project });
      const item = await createWorkItem({ project, createdBy: owner, sprintId: sprint.id });
      const url = method === 'post' ? base(project.id) : `${base(project.id)}/${sprint.id}`;
      const req = request(app)[method](url).set('Cookie', sessionCookie(viewer));
      const res = await req.send(
        method === 'post' ? input : method === 'patch' ? { name: 'No permitido' } : undefined,
      );
      expect(res.status).toBe(403);
      expect(await prisma.sprint.findMany({ where: { projectId: project.id } })).toEqual([sprint]);
      expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
    },
  );

  it.each(['post', 'get', 'patch', 'delete'] as const)(
    '%s sin sesion devuelve 401',
    async (method) => {
      const url =
        method === 'post' || method === 'get' ? base('unknown') : `${base('unknown')}/unknown`;
      const res = await request(app)
        [method](url)
        .send(method === 'post' ? input : method === 'patch' ? { name: 'Cambio' } : undefined);
      expect(res.status).toBe(401);
    },
  );

  it.each(['post', 'get', 'patch', 'delete'] as const)(
    '%s oculta el proyecto a un no miembro con 404',
    async (method) => {
      const { project } = await createProject();
      const sprint = await createSprint({ project });
      const outsider = await createUser();
      const url =
        method === 'post' || method === 'get'
          ? base(project.id)
          : `${base(project.id)}/${sprint.id}`;
      const res = await request(app)
        [method](url)
        .set('Cookie', sessionCookie(outsider))
        .send(method === 'post' ? input : method === 'patch' ? { name: 'Cambio' } : undefined);
      expect(res.status).toBe(404);
      expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
    },
  );

  it.each([{ endDate: '2026-10-27' }, { endDate: null }, { endDate: '2026-02-29' }])(
    'POST invalido devuelve 422 asociado a endDate: %j',
    async (override) => {
      const { project, owner } = await createProject();
      const res = await request(app)
        .post(base(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ ...input, ...override });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields.endDate).toEqual(expect.any(Array));
      expect(await prisma.sprint.count()).toBe(0);
    },
  );

  it('POST acepta fechas iguales', async () => {
    const { project, owner } = await createProject();
    const res = await request(app)
      .post(base(project.id))
      .set('Cookie', sessionCookie(owner))
      .send({ ...input, endDate: input.startDate });
    expect(res.status).toBe(201);
    expect(res.body.sprint.startDate).toBe(res.body.sprint.endDate);
  });

  it.each(['post', 'patch'] as const)('%s rechaza status sin modificarlo', async (method) => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project });
    const url = method === 'post' ? base(project.id) : `${base(project.id)}/${sprint.id}`;
    const res = await request(app)
      [method](url)
      .set('Cookie', sessionCookie(owner))
      .send(method === 'post' ? { ...input, status: 'ACTIVE' } : { status: 'CLOSED' });
    expect(res.status).toBe(422);
    expect(await prisma.sprint.findMany()).toEqual([sprint]);
  });

  it.each(['OWNER', 'MEMBER', 'VIEWER'] as const)(
    '%s lista ordenado con estado, items y puntos',
    async (role) => {
      const { project, owner } = await createProject();
      const actor = role === 'OWNER' ? owner : await createUser();
      if (role !== 'OWNER') await addMember(project, actor, role);
      const later = await createSprint({
        project,
        id: 'sprint_later',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        status: 'ACTIVE',
      });
      const second = await createSprint({ project, id: 'sprint_b', status: 'CLOSED' });
      const first = await createSprint({ project, id: 'sprint_a' });
      for (const [estimate, status] of [
        [5, 'DONE'],
        [null, 'BACKLOG'],
        [0, 'TODO'],
        [3, 'IN_PROGRESS'],
      ] as const) {
        await createWorkItem({ project, createdBy: owner, sprintId: first.id, estimate, status });
      }
      await createWorkItem({ project, createdBy: owner, sprintId: second.id, estimate: null });
      await createWorkItem({ project, createdBy: owner, estimate: 100 });
      const other = await createProject({ owner });
      const otherSprint = await createSprint({ project: other.project });
      await createWorkItem({
        project: other.project,
        createdBy: owner,
        sprintId: otherSprint.id,
        estimate: 100,
      });
      const res = await request(app).get(base(project.id)).set('Cookie', sessionCookie(actor));
      expect(res.status).toBe(200);
      const data = sprintListItemSchema.array().parse(res.body.data);
      expect(data.map((sprint) => sprint.id)).toEqual([first.id, second.id, later.id]);
      expect(data.map(({ items, points, status }) => ({ items, points, status }))).toEqual([
        { items: 4, points: 8, status: 'PLANNED' },
        { items: 1, points: 0, status: 'CLOSED' },
        { items: 0, points: 0, status: 'ACTIVE' },
      ]);
      expect(data[0]).toEqual({
        id: first.id,
        projectId: project.id,
        name: first.name,
        goal: null,
        startDate: '2026-10-28',
        endDate: '2026-11-11',
        status: 'PLANNED',
        createdAt: first.createdAt.toISOString(),
        updatedAt: first.updatedAt.toISOString(),
        items: 4,
        points: 8,
      });
    },
  );

  it('lista vacia devuelve data vacio', async () => {
    const { project, owner } = await createProject();
    const res = await request(app).get(base(project.id)).set('Cookie', sessionCookie(owner));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s edita parcialmente nombre, objetivo y fechas',
    async (role) => {
      const { project, owner } = await createProject();
      const actor = role === 'OWNER' ? owner : await createUser();
      if (role === 'MEMBER') await addMember(project, actor);
      const sprint = await createSprint({ project, goal: 'Antes' });
      const res = await request(app)
        .patch(`${base(project.id)}/${sprint.id}`)
        .set('Cookie', sessionCookie(actor))
        .send({ name: '  Nuevo sprint ', goal: null, startDate: '2026-11-11' });
      expect(res.status).toBe(200);
      expect(sprintSchema.parse(res.body.sprint)).toMatchObject({
        name: 'Nuevo sprint',
        goal: null,
        startDate: '2026-11-11',
        endDate: '2026-11-11',
        status: 'PLANNED',
      });
      const saved = await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } });
      expect(saved.name).toBe('Nuevo sprint');
      expect(saved.goal).toBeNull();
      expect(saved.startDate.toISOString()).toBe('2026-11-11T00:00:00.000Z');
    },
  );

  it.each([{ startDate: '2026-11-12' }, { endDate: '2026-10-27' }])(
    'PATCH compara con la fecha persistida: %j',
    async (patch) => {
      const { project, owner } = await createProject();
      const sprint = await createSprint({ project });
      const res = await request(app)
        .patch(`${base(project.id)}/${sprint.id}`)
        .set('Cookie', sessionCookie(owner))
        .send(patch);
      expect(res.status).toBe(422);
      expect(res.body.error.fields.endDate).toEqual(expect.any(Array));
      expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
    },
  );

  it('PATCH valida las dos fechas nuevas conjuntamente y permite otro intervalo', async () => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project });
    const patch = { startDate: '2026-12-01', endDate: '2026-12-15' };
    const res = await request(app)
      .patch(`${base(project.id)}/${sprint.id}`)
      .set('Cookie', sessionCookie(owner))
      .send(patch);
    expect(res.status).toBe(200);
    expect(res.body.sprint).toMatchObject(patch);
  });

  it('dos PATCH concurrentes conservan un intervalo final valido', async () => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project });
    const url = `${base(project.id)}/${sprint.id}`;
    const cookie = sessionCookie(owner);
    // Cada cambio es valido sobre el original, pero juntos invertirian las fechas.
    const responses = await Promise.all([
      request(app).patch(url).set('Cookie', cookie).send({ startDate: '2026-11-05' }),
      request(app).patch(url).set('Cookie', cookie).send({ endDate: '2026-10-30' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 422]);
    expect(
      responses.find((response) => response.status === 422)?.body.error.fields.endDate,
    ).toEqual(expect.any(Array));
    const saved = await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } });
    expect(saved.endDate.getTime()).toBeGreaterThanOrEqual(saved.startDate.getTime());
  });

  it.each(['patch', 'delete'] as const)(
    '%s devuelve 404 para sprint inexistente o de otro proyecto',
    async (method) => {
      const { project, owner } = await createProject();
      const other = await createProject({ owner });
      const sprint = await createSprint({ project: other.project });
      for (const id of ['inexistente', sprint.id]) {
        const res = await request(app)
          [method](`${base(project.id)}/${id}`)
          .set('Cookie', sessionCookie(owner))
          .send(method === 'patch' ? { name: 'Cambio' } : undefined);
        expect(res.status).toBe(404);
      }
      expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
    },
  );

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s elimina 204 y conserva WorkItem con sprintId null',
    async (role) => {
      const { project, owner } = await createProject();
      const actor = role === 'OWNER' ? owner : await createUser();
      if (role === 'MEMBER') await addMember(project, actor);
      const sprint = await createSprint({ project });
      const item = await createWorkItem({
        project,
        createdBy: owner,
        sprintId: sprint.id,
        estimate: 5,
        status: 'IN_PROGRESS',
      });
      const res = await request(app)
        .delete(`${base(project.id)}/${sprint.id}`)
        .set('Cookie', sessionCookie(actor));
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toBeNull();
      expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual({
        ...item,
        sprintId: null,
      });
      expect(await prisma.activityLog.count()).toBe(0);
    },
  );

  it('la FK real rechaza sprintId inexistente sin crear el item', async () => {
    const { project, owner } = await createProject();
    await expect(
      createWorkItem({ project, createdBy: owner, sprintId: 'sprint_inexistente' }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await prisma.workItem.count()).toBe(0);
  });
});
