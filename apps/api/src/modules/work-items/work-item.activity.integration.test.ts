import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { ACTIVITY_LIST_LIMIT } from '@mira/shared';
import {
  addMember,
  createProject,
  createUser,
  createWorkItem,
  sessionCookie,
} from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * NIVEL 2 de la piramide: integracion (MIR-22).
 *
 * Historial de un elemento: lectura por HTTP y garantia de que una edicion
 * revertida no deja entradas huerfanas en la bitacora.
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

function rutaDelHistorial(projectId: string, workItemId: string): string {
  return `/api/projects/${projectId}/work-items/${workItemId}/activity`;
}

describe('GET /api/projects/:projectId/work-items/:workItemId/activity', () => {
  it('devuelve el historial del mas reciente al mas antiguo, con actor y fecha', async () => {
    const owner = await createUser({ name: 'Ada', email: 'owner@mira.test' });
    const { project } = await createProject({ owner, key: 'MIR' });
    const workItem = await createWorkItem({ project, createdBy: owner, status: 'TODO' });
    const base = { projectId: project.id, workItemId: workItem.id, actorId: owner.id };

    await prisma.activityLog.createMany({
      data: [
        { ...base, action: 'ITEM_CREATED', createdAt: new Date('2026-10-01T10:00:00.000Z') },
        {
          ...base,
          action: 'ITEM_STATUS_CHANGED',
          field: 'status',
          fromValue: 'TODO',
          toValue: 'IN_PROGRESS',
          createdAt: new Date('2026-10-02T10:00:00.000Z'),
        },
        { ...base, action: 'COMMENT_ADDED', createdAt: new Date('2026-10-03T10:00:00.000Z') },
      ],
    });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(false);
    expect(res.body.data.map((entrada: { action: string }) => entrada.action)).toEqual([
      'COMMENT_ADDED',
      'ITEM_STATUS_CHANGED',
      'ITEM_CREATED',
    ]);
    expect(res.body.data[1]).toEqual({
      id: expect.any(String),
      action: 'ITEM_STATUS_CHANGED',
      workItemId: workItem.id,
      actor: { id: owner.id, name: 'Ada' },
      field: 'status',
      fromValue: 'TODO',
      toValue: 'IN_PROGRESS',
      createdAt: '2026-10-02T10:00:00.000Z',
    });
  });

  it('desempata por id las entradas del mismo instante', async () => {
    const owner = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });
    const createdAt = new Date('2026-10-01T10:00:00.000Z');
    const base = {
      projectId: project.id,
      workItemId: workItem.id,
      actorId: owner.id,
      action: 'ITEM_UPDATED' as const,
      createdAt,
    };

    await prisma.activityLog.createMany({
      data: [
        { ...base, id: 'activity_a', field: 'title' },
        { ...base, id: 'activity_c', field: 'priority' },
        { ...base, id: 'activity_b', field: 'type' },
      ],
    });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));

    expect(res.body.data.map((entrada: { id: string }) => entrada.id)).toEqual([
      'activity_c',
      'activity_b',
      'activity_a',
    ]);
  });

  it('solo incluye la actividad de ese item', async () => {
    const owner = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });
    const otro = await createWorkItem({ project, createdBy: owner });

    await prisma.activityLog.createMany({
      data: [
        {
          projectId: project.id,
          workItemId: workItem.id,
          actorId: owner.id,
          action: 'ITEM_CREATED',
        },
        { projectId: project.id, workItemId: otro.id, actorId: owner.id, action: 'ITEM_CREATED' },
        { projectId: project.id, workItemId: null, actorId: owner.id, action: 'PROJECT_UPDATED' },
      ],
    });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].workItemId).toBe(workItem.id);
  });

  it('entrega nombres, no ids, cuando el campo guarda un usuario', async () => {
    const owner = await createUser({ name: 'Ada', email: 'owner@mira.test' });
    const grace = await createUser({ name: 'Grace', email: 'grace@mira.test' });
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });

    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        workItemId: workItem.id,
        actorId: owner.id,
        action: 'ITEM_ASSIGNED',
        field: 'assigneeId',
        fromValue: null,
        toValue: grace.id,
      },
    });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));

    expect(res.body.data[0]).toMatchObject({ fromValue: null, toValue: 'Grace' });
  });

  it('nombra al usuario que ya no existe en vez de entregar null', async () => {
    const owner = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });

    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        workItemId: workItem.id,
        actorId: owner.id,
        action: 'ITEM_ASSIGNED',
        field: 'assigneeId',
        fromValue: null,
        toValue: 'usuario_borrado',
      },
    });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));

    // null queda reservado para "sin responsable".
    expect(res.body.data[0]).toMatchObject({ fromValue: null, toValue: 'Usuario eliminado' });
  });

  it.each([
    [ACTIVITY_LIST_LIMIT, ACTIVITY_LIST_LIMIT, false],
    [ACTIVITY_LIST_LIMIT + 1, ACTIVITY_LIST_LIMIT, true],
  ])('con %i entradas devuelve %i y truncated=%s', async (cantidad, esperadas, truncated) => {
    const owner = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });
    const inicio = Date.parse('2026-10-01T00:00:00.000Z');

    await prisma.activityLog.createMany({
      data: Array.from({ length: cantidad }, (_, index) => ({
        projectId: project.id,
        workItemId: workItem.id,
        actorId: owner.id,
        action: 'ITEM_UPDATED' as const,
        field: 'title',
        toValue: `Titulo ${index}`,
        createdAt: new Date(inicio + index * 1000),
      })),
    });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(esperadas);
    expect(res.body.truncated).toBe(truncated);
    // Se conservan las mas recientes.
    expect(res.body.data[0].toValue).toBe(`Titulo ${cantidad - 1}`);
  });

  it('VIEWER puede leer el historial', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const { project } = await createProject({ owner });
    await addMember(project, viewer, 'VIEWER');
    const workItem = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(viewer));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], truncated: false });
  });

  it('oculta el historial a quien no es miembro', async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });

    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(outsider));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 404 para un item inexistente o de otro proyecto', async () => {
    const actor = await createUser();
    const { project: projectA } = await createProject({ owner: actor });
    const ownerB = await createUser();
    const { project: projectB } = await createProject({ owner: ownerB });
    const workItemB = await createWorkItem({ project: projectB, createdBy: ownerB });

    for (const workItemId of ['work_item_inexistente', workItemB.id]) {
      const res = await request(app)
        .get(rutaDelHistorial(projectA.id, workItemId))
        .set('Cookie', sessionCookie(actor));

      expect(res.status).toBe(404);
    }
  });

  it('responde 401 sin sesion', async () => {
    const owner = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({ project, createdBy: owner });

    const res = await request(app).get(rutaDelHistorial(project.id, workItem.id));

    expect(res.status).toBe(401);
  });
});

describe('MIR-22: una edicion revertida no deja historial huerfano', () => {
  it('si falla la segunda entrada de un PATCH, no sobrevive ninguna', async () => {
    const owner = await createUser();
    const { project } = await createProject({ owner });
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Titulo original',
      priority: 'MEDIUM',
    });

    // El trigger deja pasar la entrada de `title` y hace fallar la de
    // `priority`.  Se instala FUERA de cualquier transaccion y el PATCH va por
    // HTTP: asi la atomicidad que se prueba es la del codigo de produccion,
    // no la de una transaccion abierta por el test.  La suite de integracion
    // corre en serie, por lo que el trigger no afecta a otros archivos.
    try {
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION mir22_reject_priority() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN
          IF NEW.field = 'priority' THEN RAISE EXCEPTION 'MIR22_ACTIVITY_BLOCKED'; END IF;
          RETURN NEW;
        END; $$
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS mir22_reject_priority ON activity_log
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER mir22_reject_priority BEFORE INSERT ON activity_log
        FOR EACH ROW EXECUTE FUNCTION mir22_reject_priority()
      `;

      const res = await request(app)
        .patch(`/api/projects/${project.id}/work-items/${workItem.id}`)
        .set('Cookie', sessionCookie(owner))
        .send({ title: 'Titulo que debe revertirse', priority: 'HIGH' });

      expect(res.status).toBe(500);
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS mir22_reject_priority ON activity_log`;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS mir22_reject_priority()`;
    }

    expect(await prisma.workItem.findUniqueOrThrow({ where: { id: workItem.id } })).toMatchObject({
      title: 'Titulo original',
      priority: 'MEDIUM',
    });
    expect(await prisma.activityLog.count({ where: { workItemId: workItem.id } })).toBe(0);

    // Y el historial que ve el usuario tampoco muestra nada.
    const res = await request(app)
      .get(rutaDelHistorial(project.id, workItem.id))
      .set('Cookie', sessionCookie(owner));
    expect(res.body).toEqual({ data: [], truncated: false });
  });
});
