import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createSprintRepository } from './sprint.repository.js';
import { createSprintService } from './sprint.service.js';
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
  app = (await import('../../app.js')).createApp();
});
const route = (projectId: string, id: string, action: string) =>
  `/api/projects/${projectId}/sprints/${id}/${action}`;

describe('MIR-46 ciclo de vida de sprints', () => {
  it.each(['start', 'close'])(
    '%s exige OWNER/MEMBER y rechaza VIEWER, ajeno y anonimo',
    async (action) => {
      for (const role of ['OWNER', 'MEMBER', 'VIEWER', 'OUTSIDER', 'ANONYMOUS'] as const) {
        const { project, owner } = await createProject();
        const actor = role === 'OWNER' ? owner : await createUser();
        if (role === 'MEMBER' || role === 'VIEWER') await addMember(project, actor, role);
        const sprint = await createSprint({
          project,
          status: action === 'start' ? 'PLANNED' : 'ACTIVE',
        });
        const call = request(app).post(route(project.id, sprint.id, action));
        if (role !== 'ANONYMOUS') call.set('Cookie', sessionCookie(actor));
        const response = await call.send(
          action === 'close' ? { moveUnfinishedToSprintId: null } : {},
        );
        expect(response.status).toBe(
          { OWNER: 200, MEMBER: 200, VIEWER: 403, OUTSIDER: 404, ANONYMOUS: 401 }[role],
        );
        if (response.status !== 200)
          expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
        else
          expect(response.body.sprint).toMatchObject({
            status: action === 'start' ? 'ACTIVE' : 'CLOSED',
            committedPoints: action === 'start' ? null : 0,
            completedPoints: action === 'start' ? null : 0,
          });
      }
    },
  );
  it.each(['ACTIVE', 'CLOSED'] as const)('iniciar %s no cambia nada', async (status) => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project, status });
    const response = await request(app)
      .post(route(project.id, sprint.id, 'start'))
      .set('Cookie', sessionCookie(owner));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SPRINT_NOT_PLANNED');
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
  });
  it('segundo sprint con uno ACTIVE devuelve SPRINT_ALREADY_ACTIVE', async () => {
    const { project, owner } = await createProject();
    await createSprint({ project, status: 'ACTIVE' });
    const sprint = await createSprint({ project });
    const response = await request(app)
      .post(route(project.id, sprint.id, 'start'))
      .set('Cookie', sessionCookie(owner));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SPRINT_ALREADY_ACTIVE');
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
  });
  it.each([1, 2, 3])('dos inicios concurrentes nunca dejan dos ACTIVE (%s)', async () => {
    const { project, owner } = await createProject();
    const a = await createSprint({ project });
    const b = await createSprint({ project });
    const responses = await Promise.all(
      [a, b].map((s) =>
        request(app)
          .post(route(project.id, s.id, 'start'))
          .set('Cookie', sessionCookie(owner)),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.error.code).toBe('SPRINT_ALREADY_ACTIVE');
    expect(await prisma.sprint.count({ where: { projectId: project.id, status: 'ACTIVE' } })).toBe(
      1,
    );
  });
  it('Serializable reintenta cuando ambos inicios ya leyeron que no hay ACTIVE', async () => {
    const { project, owner } = await createProject();
    const a = await createSprint({ project });
    const b = await createSprint({ project });
    const repo = createSprintRepository();
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = createSprintService({
      ...repo,
      withTransaction: (operation) =>
        repo.withTransaction((tx) =>
          operation({
            ...tx,
            hasActive: async (projectId) => {
              const active = await tx.hasActive(projectId);
              arrivals += 1;
              if (arrivals <= 2) {
                if (arrivals === 2) release();
                await gate;
              }
              return active;
            },
          }),
        ),
    });
    const results = await Promise.allSettled(
      [a, b].map((sprint) => service.start(project.id, owner.id, sprint.id)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'SPRINT_ALREADY_ACTIVE' },
    });
    expect(arrivals).toBeGreaterThan(2);
    expect(await prisma.sprint.count({ where: { projectId: project.id, status: 'ACTIVE' } })).toBe(
      1,
    );
  });
  it.each(['PLANNED', 'CLOSED'] as const)('cerrar %s no cambia nada', async (status) => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project, status });
    const response = await request(app)
      .post(route(project.id, sprint.id, 'close'))
      .set('Cookie', sessionCookie(owner))
      .send({ moveUnfinishedToSprintId: null });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SPRINT_NOT_ACTIVE');
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
  });
  it.each(['start', 'close'])(
    '%s no encuentra sprint inexistente o de otro proyecto',
    async (action) => {
      const { project, owner } = await createProject();
      const other = await createProject({ owner });
      const foreign = await createSprint({ project: other.project });
      for (const id of ['missing', foreign.id])
        expect(
          (
            await request(app)
              .post(route(project.id, id, action))
              .set('Cookie', sessionCookie(owner))
              .send({ moveUnfinishedToSprintId: null })
          ).status,
        ).toBe(404);
    },
  );
  it.each([
    {},
    { moveUnfinishedToSprintId: '' },
    { moveUnfinishedToSprintId: null, completedPoints: 9 },
  ])('cerrar exige contrato estricto %j', async (body) => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project, status: 'ACTIVE' });
    expect(
      (
        await request(app)
          .post(route(project.id, sprint.id, 'close'))
          .set('Cookie', sessionCookie(owner))
          .send(body)
      ).status,
    ).toBe(422);
    expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
  });
  it.each([null, 'planned'] as const)(
    'cierra con snapshot y mueve no terminados a %s',
    async (destination) => {
      const { project, owner } = await createProject();
      const sprint = await createSprint({ project, status: 'ACTIVE' });
      const target = await createSprint({ project });
      const done = await prisma.boardColumn.create({
        data: {
          projectId: project.id,
          name: 'Publicado a clientes',
          category: 'DONE',
          position: 10,
        },
      });
      const unfinishedColumn = await prisma.boardColumn.create({
        data: { projectId: project.id, name: 'Hecho', category: 'TODO', position: 11 },
      });
      const items = [];
      for (const [columnId, estimate] of [
        [done.id, 8],
        [done.id, null],
        [unfinishedColumn.id, 5],
        [null, 3],
        [unfinishedColumn.id, null],
      ] as const)
        items.push(
          await createWorkItem({
            project,
            createdBy: owner,
            sprintId: sprint.id,
            columnId,
            estimate,
          }),
        );
      const response = await request(app)
        .post(route(project.id, sprint.id, 'close'))
        .set('Cookie', sessionCookie(owner))
        .send({ moveUnfinishedToSprintId: destination ? target.id : null });
      expect(response.status).toBe(200);
      expect(response.body.sprint).toMatchObject({
        status: 'CLOSED',
        committedPoints: 16,
        completedPoints: 8,
      });
      for (const item of items) {
        const saved = await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } });
        const finished = item.columnId === done.id;
        expect(saved.sprintId).toBe(finished ? sprint.id : destination ? target.id : null);
        expect(saved.columnId).toBe(!finished && destination === null ? null : item.columnId);
      }
      const logs = await prisma.activityLog.findMany({ where: { field: 'sprintId' } });
      expect(logs).toHaveLength(3);
      expect(
        logs.every(
          (log) => log.fromValue === sprint.id && log.toValue === (destination ? target.id : null),
        ),
      ).toBe(true);
      // El snapshot no depende del contenido posterior ni de renombres/categorias.
      await prisma.workItem.update({ where: { id: items[0]!.id }, data: { estimate: 99 } });
      await prisma.boardColumn.update({ where: { id: done.id }, data: { category: 'TODO' } });
      await prisma.workItem.delete({ where: { id: items[1]!.id } });
      const list = await request(app)
        .get(`/api/projects/${project.id}/sprints`)
        .set('Cookie', sessionCookie(owner));
      expect(list.body.data.find((s: { id: string }) => s.id === sprint.id)).toMatchObject({
        committedPoints: 16,
        completedPoints: 8,
        items: 1,
        points: 99,
      });
    },
  );
  it.each(['missing', 'self', 'foreign', 'ACTIVE', 'CLOSED'])(
    'rechaza destino %s sin cambios parciales',
    async (destination) => {
      const { project, owner } = await createProject();
      const source = await createSprint({ project, status: 'ACTIVE' });
      const other = await createProject({ owner });
      const target = await createSprint({
        project: destination === 'foreign' ? other.project : project,
        status:
          destination === 'ACTIVE' ? 'ACTIVE' : destination === 'CLOSED' ? 'CLOSED' : 'PLANNED',
      });
      const item = await createWorkItem({
        project,
        createdBy: owner,
        sprintId: source.id,
        estimate: 5,
      });
      const id =
        destination === 'missing' ? 'missing' : destination === 'self' ? source.id : target.id;
      const response = await request(app)
        .post(route(project.id, source.id, 'close'))
        .set('Cookie', sessionCookie(owner))
        .send({ moveUnfinishedToSprintId: id });
      expect(response.status).toBe(
        destination === 'missing'
          ? 404
          : destination === 'foreign' || destination === 'self'
            ? 400
            : 409,
      );
      expect(await prisma.sprint.findUnique({ where: { id: source.id } })).toEqual(source);
      expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
      expect(await prisma.activityLog.count()).toBe(0);
    },
  );
  it('revierte estado, snapshot, movimientos e historial ante fallo', async () => {
    const { project, owner } = await createProject();
    const sprint = await createSprint({ project, status: 'ACTIVE' });
    const item = await createWorkItem({
      project,
      createdBy: owner,
      sprintId: sprint.id,
      estimate: 5,
    });
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION mir46_fail_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'MIR46_MOVE_BLOCKED'; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER mir46_fail_move BEFORE UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION mir46_fail_move()`,
    );
    try {
      expect(
        (
          await request(app)
            .post(route(project.id, sprint.id, 'close'))
            .set('Cookie', sessionCookie(owner))
            .send({ moveUnfinishedToSprintId: null })
        ).status,
      ).toBe(500);
      expect(await prisma.sprint.findUnique({ where: { id: sprint.id } })).toEqual(sprint);
      expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
      expect(await prisma.activityLog.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER mir46_fail_move ON work_items');
      await prisma.$executeRawUnsafe('DROP FUNCTION mir46_fail_move()');
    }
  });
  it.each(['assignment-first', 'close-first'])(
    'coordina FOR SHARE de MIR-45 con el cierre: %s',
    async (order) => {
      const { project, owner } = await createProject();
      const sprint = await createSprint({ project, status: 'ACTIVE' });
      const item = await createWorkItem({ project, createdBy: owner, estimate: 3 });
      let unlock!: () => void;
      let ready!: () => void;
      const gate = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const locked = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM sprints WHERE id = ${sprint.id} FOR UPDATE`;
          ready();
          await gate;
        },
        { timeout: 15000 },
      );
      await locked;
      const assign = () =>
        request(app)
          .patch(`/api/projects/${project.id}/work-items/${item.id}/sprint`)
          .set('Cookie', sessionCookie(owner))
          .send({ sprintId: sprint.id })
          .then((r) => r);
      const close = () =>
        request(app)
          .post(route(project.id, sprint.id, 'close'))
          .set('Cookie', sessionCookie(owner))
          .send({ moveUnfinishedToSprintId: null })
          .then((r) => r);
      const waitForLocks = async (count: number) => {
        const end = Date.now() + 4000;
        while (Date.now() < end) {
          const [row] = await prisma.$queryRaw<
            Array<{ count: bigint }>
          >`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%FROM sprints%'`;
          if (Number(row!.count) >= count) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw new Error('No se alcanzaron los locks concurrentes esperados');
      };
      const pending: ReturnType<typeof assign>[] = [];
      try {
        pending.push(order === 'assignment-first' ? assign() : close());
        await waitForLocks(1);
        pending.push(order === 'assignment-first' ? close() : assign());
        await waitForLocks(2);
      } finally {
        unlock();
        await holder;
      }
      const responses = await Promise.all(pending);
      const assignment = responses[order === 'assignment-first' ? 0 : 1]!;
      const closure = responses[order === 'assignment-first' ? 1 : 0]!;
      expect(closure.status).toBe(200);
      expect([200, 409]).toContain(assignment.status);
      if (assignment.status === 409) expect(assignment.body.error.code).toBe('SPRINT_CLOSED');
      expect(
        (await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).sprintId,
      ).toBeNull();
      const saved = await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } });
      expect(saved.status).toBe('CLOSED');
      expect(saved.committedPoints).toBe(assignment.status === 200 ? 3 : 0);
    },
  );
});
