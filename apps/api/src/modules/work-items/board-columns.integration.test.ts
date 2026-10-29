import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Project } from '@prisma/client';
import { DEFAULT_BOARD_COLUMNS } from '@mira/shared';
import {
  columnIdOfStatus,
  createProject,
  createUser,
  createWorkItem,
  sessionCookie,
} from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * MIR-31: los estados del tablero viven en columnas por proyecto.
 *
 * Integracion de punta a punta (Express, service, repository y PostgreSQL).
 * La migracion de los datos existentes se prueba aparte, en
 * board-columns.migration.integration.test.ts.
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

const rutaDeEstado = (projectId: string, workItemId: string) =>
  `/api/projects/${projectId}/work-items/${workItemId}/status`;
const rutaDelTablero = (projectId: string) => `/api/projects/${projectId}/board`;

/** Columna nueva creada directo en la base, como lo hara MIR-48. */
async function crearColumna(
  project: Project,
  data: { name: string; position: number; category: 'TODO' | 'IN_PROGRESS' | 'DONE' },
) {
  return prisma.boardColumn.create({ data: { projectId: project.id, ...data } });
}

describe('MIR-31: columnas por proyecto', () => {
  describe('proyectos nuevos', () => {
    it('nacen con Por hacer, En progreso, En revision y Hecho, en ese orden', async () => {
      const owner = await createUser();

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'Proyecto nuevo', key: 'NUE' });

      expect(res.status).toBe(201);
      const columnas = await prisma.boardColumn.findMany({
        where: { projectId: res.body.project.id },
        orderBy: { position: 'asc' },
      });
      expect(
        columnas.map(({ name, position, category, legacyStatus }) => ({
          name,
          position,
          category,
          legacyStatus,
        })),
      ).toEqual([
        { name: 'Por hacer', position: 0, category: 'TODO', legacyStatus: 'TODO' },
        { name: 'En progreso', position: 1, category: 'IN_PROGRESS', legacyStatus: 'IN_PROGRESS' },
        { name: 'En revision', position: 2, category: 'IN_PROGRESS', legacyStatus: 'IN_REVIEW' },
        { name: 'Hecho', position: 3, category: 'DONE', legacyStatus: 'DONE' },
      ]);
    });

    it('el tablero devuelve las columnas del proyecto en su orden', async () => {
      const { project, owner } = await createProject();

      const res = await request(app)
        .get(rutaDelTablero(project.id))
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(200);
      expect(res.body.columns.map((c: { name: string }) => c.name)).toEqual(
        DEFAULT_BOARD_COLUMNS.map((c) => c.name),
      );
      // legacyStatus es interno del puente: no sale por la API.
      expect(res.body.columns[0]).toEqual({
        id: expect.any(String),
        name: 'Por hacer',
        position: 0,
        category: 'TODO',
      });
    });
  });

  describe('backlog', () => {
    it('un elemento sin columna es BACKLOG y no aparece en el tablero', async () => {
      const { project, owner } = await createProject();
      const enBacklog = await createWorkItem({ project, createdBy: owner, status: 'BACKLOG' });
      const enTablero = await createWorkItem({ project, createdBy: owner, status: 'TODO' });

      const tablero = await request(app)
        .get(rutaDelTablero(project.id))
        .set('Cookie', sessionCookie(owner));
      const detalle = await request(app)
        .get(`/api/projects/${project.id}/work-items/${enBacklog.id}`)
        .set('Cookie', sessionCookie(owner));

      expect(tablero.body.items.map((item: { id: string }) => item.id)).toEqual([enTablero.id]);
      expect(detalle.body.item).toMatchObject({ status: 'BACKLOG', columnId: null, column: null });
    });

    it('crear sin estado ni columna deja el elemento en el backlog', async () => {
      const { project, owner } = await createProject();

      const res = await request(app)
        .post(`/api/projects/${project.id}/work-items`)
        .set('Cookie', sessionCookie(owner))
        .send({ title: 'Sin columna' });

      expect(res.status).toBe(201);
      expect(res.body.item).toMatchObject({ status: 'BACKLOG', columnId: null, column: null });
    });
  });

  describe('crear en una columna', () => {
    it('acepta columnId y deriva el estado de la columna', async () => {
      const { project, owner } = await createProject();
      const enRevision = await columnIdOfStatus(project, 'IN_REVIEW');

      const res = await request(app)
        .post(`/api/projects/${project.id}/work-items`)
        .set('Cookie', sessionCookie(owner))
        .send({ title: 'Directo a revision', columnId: enRevision });

      expect(res.status).toBe(201);
      expect(res.body.item).toMatchObject({
        status: 'IN_REVIEW',
        columnId: enRevision,
        column: { name: 'En revision', category: 'IN_PROGRESS' },
      });
    });

    it('el estado antiguo se traduce a su columna por defecto', async () => {
      const { project, owner } = await createProject();

      const res = await request(app)
        .post(`/api/projects/${project.id}/work-items`)
        .set('Cookie', sessionCookie(owner))
        .send({ title: 'Por estado', status: 'DONE' });

      expect(res.status).toBe(201);
      expect(res.body.item.columnId).toBe(await columnIdOfStatus(project, 'DONE'));
    });

    it('rechaza con 400 una columna de otro proyecto', async () => {
      const { project, owner } = await createProject();
      const { project: otro } = await createProject({ owner });

      const res = await request(app)
        .post(`/api/projects/${project.id}/work-items`)
        .set('Cookie', sessionCookie(owner))
        .send({ title: 'Columna ajena', columnId: await columnIdOfStatus(otro, 'TODO') });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COLUMN_NOT_IN_PROJECT');
      expect(await prisma.workItem.count()).toBe(0);
    });
  });

  describe('mover entre columnas', () => {
    it('mueve por columnId y registra ITEM_STATUS_CHANGED', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });
      const hecho = await columnIdOfStatus(project, 'DONE');

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnId: hecho });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({ status: 'DONE', columnId: hecho });
      const actividad = await prisma.activityLog.findMany({ where: { workItemId: item.id } });
      expect(actividad).toMatchObject([
        { action: 'ITEM_STATUS_CHANGED', field: 'status', fromValue: 'TODO', toValue: 'DONE' },
      ]);
    });

    it('columnId null devuelve el elemento al backlog', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'IN_PROGRESS' });

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnId: null });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({ status: 'BACKLOG', columnId: null });
      expect(await prisma.activityLog.findFirst()).toMatchObject({
        fromValue: 'IN_PROGRESS',
        toValue: 'BACKLOG',
      });
    });

    it('en una columna nueva registra su nombre y deriva el estado de la categoria', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });
      const desplegado = await crearColumna(project, {
        name: 'Desplegado',
        position: 4,
        category: 'DONE',
      });

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnId: desplegado.id });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({
        status: 'DONE',
        column: { name: 'Desplegado', category: 'DONE' },
      });
      expect(await prisma.activityLog.findFirst()).toMatchObject({
        fromValue: 'TODO',
        toValue: 'Desplegado',
      });
    });

    it('mover a la misma columna no escribe historial', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnId: await columnIdOfStatus(project, 'TODO') });

      expect(res.status).toBe(200);
      expect(await prisma.activityLog.count()).toBe(0);
    });

    it('rechaza con 400 una columna de otro proyecto sin mover nada', async () => {
      const { project, owner } = await createProject();
      const { project: otro } = await createProject({ owner });
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnId: await columnIdOfStatus(otro, 'DONE') });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COLUMN_NOT_IN_PROJECT');
      expect((await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).columnId).toBe(
        await columnIdOfStatus(project, 'TODO'),
      );
      expect(await prisma.activityLog.count()).toBe(0);
    });

    it('rechaza con 422 un cuerpo con estado y columna a la vez', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ status: 'DONE', columnId: await columnIdOfStatus(project, 'DONE') });

      expect(res.status).toBe(422);
    });

    it('responde 409 si el estado antiguo ya no tiene su columna por defecto', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });
      // Simula a MIR-48 eliminando la columna En revision (vacia).
      await prisma.boardColumn.deleteMany({
        where: { projectId: project.id, legacyStatus: 'IN_REVIEW' },
      });

      const res = await request(app)
        .patch(rutaDeEstado(project.id, item.id))
        .set('Cookie', sessionCookie(owner))
        .send({ status: 'IN_REVIEW' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STATUS_COLUMN_MISSING');
    });
  });

  describe('filtros del backlog', () => {
    it('filtra por columnId y por estado, incluyendo columnas nuevas de esa categoria', async () => {
      const { project, owner } = await createProject();
      const enProgreso = await createWorkItem({ project, createdBy: owner, status: 'IN_PROGRESS' });
      const enRevision = await createWorkItem({ project, createdBy: owner, status: 'IN_REVIEW' });
      const qa = await crearColumna(project, { name: 'QA', position: 4, category: 'IN_PROGRESS' });
      const enQa = await createWorkItem({ project, createdBy: owner, columnId: qa.id });
      await createWorkItem({ project, createdBy: owner, status: 'BACKLOG' });
      const cookie = sessionCookie(owner);
      const listar = async (query: string) => {
        const res = await request(app)
          .get(`/api/projects/${project.id}/work-items?${query}`)
          .set('Cookie', cookie);
        expect(res.status).toBe(200);
        return res.body.data.map((item: { id: string }) => item.id).sort();
      };

      expect(await listar(`columnId=${qa.id}`)).toEqual([enQa.id]);
      expect(await listar('status=IN_PROGRESS')).toEqual([enProgreso.id, enQa.id].sort());
      expect(await listar('status=IN_REVIEW')).toEqual([enRevision.id]);
      expect(await listar('status=BACKLOG')).toHaveLength(1);
      expect(await listar(`status=BACKLOG&columnId=${qa.id}`)).toEqual([]);
    });
  });

  describe('panel del proyecto', () => {
    it('cuenta por categoria aunque las columnas se llamen distinto', async () => {
      const { project, owner } = await createProject();
      await createWorkItem({ project, createdBy: owner, status: 'BACKLOG' });
      await createWorkItem({ project, createdBy: owner, status: 'TODO' });
      await createWorkItem({ project, createdBy: owner, status: 'IN_PROGRESS' });
      await createWorkItem({ project, createdBy: owner, status: 'IN_REVIEW' });
      await createWorkItem({ project, createdBy: owner, status: 'DONE' });
      const desplegado = await crearColumna(project, {
        name: 'Desplegado',
        position: 4,
        category: 'DONE',
      });
      await createWorkItem({ project, createdBy: owner, columnId: desplegado.id });
      await prisma.boardColumn.updateMany({
        where: { projectId: project.id, legacyStatus: 'DONE' },
        data: { name: 'Terminado' },
      });

      const res = await request(app)
        .get(`/api/projects/${project.id}/summary`)
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(200);
      expect(res.body.summary).toMatchObject({
        total: 6,
        byCategory: { BACKLOG: 1, TODO: 1, IN_PROGRESS: 2, DONE: 2 },
        byStatus: { BACKLOG: 1, TODO: 1, IN_PROGRESS: 1, IN_REVIEW: 1, DONE: 2 },
      });
    });
  });

  describe('integridad en la base', () => {
    it('impide poner un elemento en la columna de otro proyecto', async () => {
      const { project, owner } = await createProject();
      const { project: otro } = await createProject({ owner });
      const item = await createWorkItem({ project, createdBy: owner });

      await expect(
        prisma.workItem.update({
          where: { id: item.id },
          data: { columnId: await columnIdOfStatus(otro, 'TODO') },
        }),
      ).rejects.toThrow();
    });

    it('impide borrar una columna que todavia tiene elementos', async () => {
      const { project, owner } = await createProject();
      await createWorkItem({ project, createdBy: owner, status: 'TODO' });

      await expect(
        prisma.boardColumn.deleteMany({ where: { projectId: project.id, legacyStatus: 'TODO' } }),
      ).rejects.toThrow();
    });

    it('al eliminar el proyecto caen sus columnas y elementos', async () => {
      const { project, owner } = await createProject();
      await createWorkItem({ project, createdBy: owner, status: 'DONE' });

      await prisma.project.delete({ where: { id: project.id } });

      expect(await prisma.boardColumn.count()).toBe(0);
      expect(await prisma.workItem.count()).toBe(0);
    });
  });
});
