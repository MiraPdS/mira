import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
 * MIR-8: eliminar un proyecto.
 *
 * Criterios: 204 al OWNER y el proyecto desaparece de su lista; items,
 * comentarios y bitacora caen en cascada; 403 a quien no es OWNER. (El
 * dialogo de confirmacion se prueba en ProjectSettingsPage.test.tsx).
 *
 * Requiere:  npm run db:up
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

describe('DELETE /api/projects/:projectId', () => {
  // El service registra cada eliminacion en el log (auditoria): se silencia.
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CA1: el OWNER recibe 204 y el proyecto desaparece de su lista', async () => {
    const { project, owner } = await createProject({ name: 'Proyecto a borrar' });
    const { project: otro } = await createProject({ owner, name: 'Proyecto que queda' });

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const lista = await request(app).get('/api/projects').set('Cookie', sessionCookie(owner));
    expect(lista.body.projects.map((p: { id: string }) => p.id)).toEqual([otro.id]);

    const detalle = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));
    expect(detalle.status).toBe(403);
  });

  it('CA2: elimina en cascada miembros, items, comentarios y bitacora', async () => {
    const { project, owner } = await createProject();
    const miembro = await createUser();
    await addMember(project, miembro, 'MEMBER');
    const item = await createWorkItem({ project, createdBy: owner });
    await prisma.comment.create({
      data: { body: 'Comentario', workItemId: item.id, authorId: miembro.id },
    });
    await prisma.activityLog.create({
      data: {
        action: 'ITEM_CREATED',
        projectId: project.id,
        workItemId: item.id,
        actorId: owner.id,
      },
    });

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(204);
    expect(await prisma.project.count({ where: { id: project.id } })).toBe(0);
    expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.workItem.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.comment.count({ where: { workItemId: item.id } })).toBe(0);
    expect(await prisma.activityLog.count({ where: { projectId: project.id } })).toBe(0);

    // Los usuarios no se borran: solo su relacion con el proyecto.
    expect(await prisma.user.count({ where: { id: { in: [owner.id, miembro.id] } } })).toBe(2);
  });

  it('no toca los datos de otros proyectos', async () => {
    const { project, owner } = await createProject();
    const { project: ajeno, owner: otroOwner } = await createProject();
    await createWorkItem({ project: ajeno, createdBy: otroOwner });

    await request(app).delete(`/api/projects/${project.id}`).set('Cookie', sessionCookie(owner));

    expect(await prisma.project.count({ where: { id: ajeno.id } })).toBe(1);
    expect(await prisma.workItem.count({ where: { projectId: ajeno.id } })).toBe(1);
  });

  it.each(['MEMBER', 'VIEWER'] as const)(
    'CA3: responde 403 a un %s y no elimina nada',
    async (role) => {
      const { project } = await createProject();
      const user = await createUser();
      await addMember(project, user, role);

      const res = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set('Cookie', sessionCookie(user));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_REQUIRED');
      expect(await prisma.project.count({ where: { id: project.id } })).toBe(1);
    },
  );

  it('CA3: responde 403 a quien no es miembro', async () => {
    const { project } = await createProject();
    const intruso = await createUser();

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(intruso));

    expect(res.status).toBe(403);
    expect(await prisma.project.count({ where: { id: project.id } })).toBe(1);
  });

  it('un segundo DELETE del mismo proyecto responde 404, no 403', async () => {
    const { project, owner } = await createProject();

    const primero = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));
    const segundo = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));

    expect(primero.status).toBe(204);
    expect(segundo.status).toBe(404);
    expect(segundo.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('un OWNER degradado antes de confirmar recibe 403 y no borra', async () => {
    const { project, owner } = await createProject();
    const otroOwner = await createUser();
    await addMember(project, otroOwner, 'OWNER');
    await prisma.projectMember.update({
      where: { userId_projectId: { userId: owner.id, projectId: project.id } },
      data: { role: 'MEMBER' },
    });

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Cookie', sessionCookie(owner));

    expect(res.status).toBe(403);
    expect(await prisma.project.count({ where: { id: project.id } })).toBe(1);
  });

  it('requiere sesion', async () => {
    const { project } = await createProject();

    const res = await request(app).delete(`/api/projects/${project.id}`);

    expect(res.status).toBe(401);
    expect(await prisma.project.count({ where: { id: project.id } })).toBe(1);
  });
});
