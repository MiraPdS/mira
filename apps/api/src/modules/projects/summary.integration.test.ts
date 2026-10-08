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

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

describe('GET /api/projects/:projectId/summary (MIR-23)', () => {
  it('devuelve 401 cuando no existe una sesion', async () => {
    const { project } = await createProject();

    const res = await request(app).get(`/api/projects/${project.id}/summary`);

    expect(res.status).toBe(401);
  });

  it('devuelve 403 cuando el usuario no pertenece al proyecto', async () => {
    const { project } = await createProject();
    const outsider = await createUser();

    const res = await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set('Cookie', sessionCookie(outsider));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it('permite consultar el resumen a un miembro VIEWER', async () => {
    const { project } = await createProject();
    const viewer = await createUser();

    await addMember(project, viewer, 'VIEWER');

    const res = await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set('Cookie', sessionCookie(viewer));

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(0);
  });

  it('devuelve todos los contadores en cero para un proyecto vacio', async () => {
    const { project, owner } = await createProject();

    const res = await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);

    expect(res.body.summary).toEqual({
      total: 0,
      byStatus: {
        BACKLOG: 0,
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      },
      byType: {
        EPIC: 0,
        STORY: 0,
        TASK: 0,
        BUG: 0,
      },
      byPriority: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
      recentActivity: [],
    });
  });

  it('calcula correctamente los conteos por estado, tipo y prioridad', async () => {
    const { project, owner } = await createProject();

    await createWorkItem({
      project,
      createdBy: owner,
      status: 'BACKLOG',
      type: 'TASK',
      priority: 'LOW',
    });

    await createWorkItem({
      project,
      createdBy: owner,
      status: 'IN_PROGRESS',
      type: 'STORY',
      priority: 'HIGH',
    });

    await createWorkItem({
      project,
      createdBy: owner,
      status: 'DONE',
      type: 'BUG',
      priority: 'CRITICAL',
    });

    await createWorkItem({
      project,
      createdBy: owner,
      status: 'DONE',
      type: 'TASK',
      priority: 'HIGH',
    });

    const res = await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(4);

    expect(res.body.summary.byStatus).toEqual({
      BACKLOG: 1,
      TODO: 0,
      IN_PROGRESS: 1,
      IN_REVIEW: 0,
      DONE: 2,
    });

    expect(res.body.summary.byType).toEqual({
      EPIC: 0,
      STORY: 1,
      TASK: 2,
      BUG: 1,
    });

    expect(res.body.summary.byPriority).toEqual({
      LOW: 1,
      MEDIUM: 0,
      HIGH: 2,
      CRITICAL: 1,
    });
  });

  it('no incluye items de otros proyectos en los conteos', async () => {
    const { project, owner } = await createProject();
    const { project: otherProject, owner: otherOwner } = await createProject();

    await createWorkItem({
      project,
      createdBy: owner,
      status: 'TODO',
    });

    await createWorkItem({
      project: otherProject,
      createdBy: otherOwner,
      status: 'DONE',
    });

    const res = await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(1);
    expect(res.body.summary.byStatus.TODO).toBe(1);
    expect(res.body.summary.byStatus.DONE).toBe(0);
  });

  it('devuelve solo las 10 actividades mas recientes del proyecto', async () => {
    const { project, owner } = await createProject();

    for (let i = 0; i < 12; i++) {
      await prisma.activityLog.create({
        data: {
          action: 'ITEM_CREATED',
          projectId: project.id,
          actorId: owner.id,
          field: 'title',
          toValue: `Actividad ${i}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
        },
      });
    }

    const res = await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(200);

    const activities = res.body.summary.recentActivity;

    expect(activities).toHaveLength(10);
    expect(activities[0].toValue).toBe('Actividad 11');
    expect(activities[9].toValue).toBe('Actividad 2');

    expect(activities[0].actor).toEqual({
      id: owner.id,
      name: owner.name,
    });

    expect(activities[0].createdAt).toBe(new Date(Date.UTC(2026, 0, 1, 0, 11)).toISOString());
  });
});
