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

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

function cookieDeSesion(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((cookie) => cookie.startsWith('mira_token='));
}

async function iniciarSesion(user: User): Promise<string> {
  const login = await request(app).post('/api/auth/login').send({
    email: user.email,
    password: PASSWORD_DE_PRUEBA,
  });

  expect(login.status).toBe(200);

  const cookie = cookieDeSesion(login);

  if (!cookie) {
    throw new Error('El login de prueba no entrego una cookie de sesion');
  }

  return cookie;
}

function rutaComentarios(projectId: string, workItemId: string): string {
  return `/api/projects/${projectId}/work-items/${workItemId}/comments`;
}

describe('POST /api/projects/:projectId/work-items/:workItemId/comments', () => {
  it.each(['OWNER', 'MEMBER'] as const)(
    '%s puede crear un comentario y recibe 201 con autor y fecha',
    async (role) => {
      const { project, owner } = await createProject();
      const actor = role === 'OWNER' ? owner : await createUser();

      if (role === 'MEMBER') {
        await addMember(project, actor, 'MEMBER');
      }

      const workItem = await createWorkItem({
        project,
        createdBy: owner,
      });

      const cookie = await iniciarSesion(actor);

      const res = await request(app)
        .post(rutaComentarios(project.id, workItem.id))
        .set('Cookie', cookie)
        .send({ body: '  Revisar este elemento  ' });

      expect(res.status).toBe(201);

      expect(res.body.comment).toMatchObject({
        body: 'Revisar este elemento',
        author: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          createdAt: actor.createdAt.toISOString(),
        },
      });

      expect(Number.isNaN(Date.parse(res.body.comment.createdAt))).toBe(false);

      const saved = await prisma.comment.findUnique({
        where: { id: res.body.comment.id },
      });

      expect(saved).toMatchObject({
        body: 'Revisar este elemento',
        workItemId: workItem.id,
        authorId: actor.id,
      });

      const activities = await prisma.activityLog.findMany({
        where: {
          projectId: project.id,
          workItemId: workItem.id,
          action: 'COMMENT_ADDED',
        },
      });

      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        actorId: actor.id,
        projectId: project.id,
        workItemId: workItem.id,
        action: 'COMMENT_ADDED',
      });
    },
  );

  it.each(['', '   ', '\n\t  '])(
    'rechaza comentario vacio o solo espacios con 422: %j',
    async (body) => {
      const { project, owner } = await createProject();
      const workItem = await createWorkItem({
        project,
        createdBy: owner,
      });

      const cookie = await iniciarSesion(owner);

      const res = await request(app)
        .post(rutaComentarios(project.id, workItem.id))
        .set('Cookie', cookie)
        .send({ body });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      expect(
        await prisma.comment.count({
          where: { workItemId: workItem.id },
        }),
      ).toBe(0);

      expect(
        await prisma.activityLog.count({
          where: {
            workItemId: workItem.id,
            action: 'COMMENT_ADDED',
          },
        }),
      ).toBe(0);
    },
  );

  it('rechaza a VIEWER con 403 sin crear comentarios', async () => {
    const { project, owner } = await createProject();
    const viewer = await createUser();

    await addMember(project, viewer, 'VIEWER');

    const workItem = await createWorkItem({
      project,
      createdBy: owner,
    });

    const cookie = await iniciarSesion(viewer);

    const res = await request(app)
      .post(rutaComentarios(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ body: 'No deberia poder comentar' });

    expect(res.status).toBe(403);

    expect(
      await prisma.comment.count({
        where: { workItemId: workItem.id },
      }),
    ).toBe(0);

    expect(
      await prisma.activityLog.count({
        where: {
          workItemId: workItem.id,
          action: 'COMMENT_ADDED',
        },
      }),
    ).toBe(0);
  });

  it('responde 404 cuando el usuario no pertenece al proyecto', async () => {
    const { project, owner } = await createProject();
    const outsider = await createUser();

    const workItem = await createWorkItem({
      project,
      createdBy: owner,
    });

    const cookie = await iniciarSesion(outsider);

    const res = await request(app)
      .post(rutaComentarios(project.id, workItem.id))
      .set('Cookie', cookie)
      .send({ body: 'Comentario externo' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 404 para un elemento inexistente', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .post(rutaComentarios(project.id, 'item_inexistente'))
      .set('Cookie', cookie)
      .send({ body: 'Comentario' });

    expect(res.status).toBe(404);
  });

  it('requiere una sesion valida', async () => {
    const { project, owner } = await createProject();
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
    });

    const res = await request(app)
      .post(rutaComentarios(project.id, workItem.id))
      .send({ body: 'Comentario sin sesion' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects/:projectId/work-items/:workItemId/comments', () => {
  it('devuelve comentarios del mas antiguo al mas reciente', async () => {
    const { project, owner } = await createProject();
    const workItem = await createWorkItem({
      project,
      createdBy: owner,
    });

    const comments = [];

    for (const body of ['Primero', 'Segundo', 'Tercero']) {
      const comment = await prisma.comment.create({
        data: {
          body,
          workItemId: workItem.id,
          authorId: owner.id,
        },
      });

      comments.push(comment);
    }

    const dates = [
      new Date('2026-01-01T10:00:00.000Z'),
      new Date('2026-01-02T10:00:00.000Z'),
      new Date('2026-01-03T10:00:00.000Z'),
    ];

    await Promise.all(
      comments.map((comment, index) =>
        prisma.comment.update({
          where: { id: comment.id },
          data: { createdAt: dates[index] },
        }),
      ),
    );

    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(rutaComentarios(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(3);

    expect(res.body.comments.map((comment: { body: string }) => comment.body)).toEqual([
      'Primero',
      'Segundo',
      'Tercero',
    ]);

    expect(res.body.comments.map((comment: { createdAt: string }) => comment.createdAt)).toEqual(
      dates.map((date) => date.toISOString()),
    );
  });

  it('permite a VIEWER leer comentarios', async () => {
    const { project, owner } = await createProject();
    const viewer = await createUser();

    await addMember(project, viewer, 'VIEWER');

    const workItem = await createWorkItem({
      project,
      createdBy: owner,
    });

    await prisma.comment.create({
      data: {
        body: 'Comentario visible',
        workItemId: workItem.id,
        authorId: owner.id,
      },
    });

    const cookie = await iniciarSesion(viewer);

    const res = await request(app)
      .get(rutaComentarios(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].body).toBe('Comentario visible');
  });

  it('no permite leer comentarios de proyectos ajenos', async () => {
    const { project, owner } = await createProject();
    const outsider = await createUser();

    const workItem = await createWorkItem({
      project,
      createdBy: owner,
    });

    const cookie = await iniciarSesion(outsider);

    const res = await request(app)
      .get(rutaComentarios(project.id, workItem.id))
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('responde 404 para un elemento inexistente', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner);

    const res = await request(app)
      .get(rutaComentarios(project.id, 'item_inexistente'))
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});
