import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Project, User } from '@prisma/client';
import { DEFAULT_BOARD_COLUMNS, type ProjectRole } from '@mira/shared';
import {
  addMember,
  columnIdOfStatus,
  createProject,
  createUser,
  createWorkItem,
  sessionCookie,
} from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * MIR-48: API de columnas, de punta a punta contra PostgreSQL. Cada `describe`
 * sigue un criterio de aceptacion de la historia.
 */

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

const rutaColumnas = (projectId: string) => `/api/projects/${projectId}/columns`;
const rutaColumna = (projectId: string, columnId: string) =>
  `/api/projects/${projectId}/columns/${columnId}`;
const rutaOrden = (projectId: string) => `/api/projects/${projectId}/columns/order`;

/** Columnas del proyecto como las ve el tablero tras recargar. */
async function nombresDelTablero(project: Project, user: User): Promise<string[]> {
  const res = await request(app)
    .get(`/api/projects/${project.id}/board`)
    .set('Cookie', sessionCookie(user));
  expect(res.status).toBe(200);
  return res.body.columns.map((column: { name: string }) => column.name);
}

const NOMBRES_POR_DEFECTO = DEFAULT_BOARD_COLUMNS.map((column) => column.name);

describe('MIR-48: API de columnas', () => {
  describe('listar', () => {
    it.each<ProjectRole>(['MEMBER', 'VIEWER'])(
      'cualquier miembro (%s) ve las columnas en su orden',
      async (role) => {
        const { project } = await createProject();
        const miembro = await createUser();
        await addMember(project, miembro, role);

        const res = await request(app)
          .get(rutaColumnas(project.id))
          .set('Cookie', sessionCookie(miembro));

        expect(res.status).toBe(200);
        expect(res.body.columns.map((c: { name: string }) => c.name)).toEqual(NOMBRES_POR_DEFECTO);
      },
    );

    it('quien no es miembro recibe 403', async () => {
      const { project } = await createProject();
      const ajeno = await createUser();

      const res = await request(app)
        .get(rutaColumnas(project.id))
        .set('Cookie', sessionCookie(ajeno));

      expect(res.status).toBe(403);
    });
  });

  describe('crear', () => {
    it('el OWNER crea una columna con nombre y categoria y queda al final (201)', async () => {
      const { project, owner } = await createProject();

      const res = await request(app)
        .post(rutaColumnas(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ name: '  QA  ', category: 'IN_PROGRESS' });

      expect(res.status).toBe(201);
      expect(res.body.column).toEqual({
        id: expect.any(String),
        name: 'QA',
        position: DEFAULT_BOARD_COLUMNS.length,
        category: 'IN_PROGRESS',
      });
      expect(await nombresDelTablero(project, owner)).toEqual([...NOMBRES_POR_DEFECTO, 'QA']);
    });

    it('rechaza con 422 una categoria que no existe', async () => {
      const { project, owner } = await createProject();

      const res = await request(app)
        .post(rutaColumnas(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'QA', category: 'IN_REVIEW' });

      expect(res.status).toBe(422);
    });

    it('un elemento se puede mover a la columna nueva y su estado sale de la categoria', async () => {
      const { project, owner } = await createProject();
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });
      const creada = await request(app)
        .post(rutaColumnas(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'QA', category: 'IN_PROGRESS' });

      const res = await request(app)
        .patch(`/api/projects/${project.id}/work-items/${item.id}/status`)
        .set('Cookie', sessionCookie(owner))
        .send({ columnId: creada.body.column.id });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({ status: 'IN_PROGRESS', column: { name: 'QA' } });
    });
  });

  describe('permisos', () => {
    it.each<ProjectRole>(['MEMBER', 'VIEWER'])(
      '%s recibe 403 al crear, renombrar, reordenar o eliminar',
      async (role) => {
        const { project } = await createProject();
        const usuario = await createUser();
        await addMember(project, usuario, role);
        const cookie = sessionCookie(usuario);
        const columnas = await prisma.boardColumn.findMany({
          where: { projectId: project.id },
          orderBy: { position: 'asc' },
        });
        const enProgreso = columnas[1]!;

        const respuestas = await Promise.all([
          request(app)
            .post(rutaColumnas(project.id))
            .set('Cookie', cookie)
            .send({ name: 'QA', category: 'TODO' }),
          request(app)
            .patch(rutaColumna(project.id, enProgreso.id))
            .set('Cookie', cookie)
            .send({ name: 'Haciendo' }),
          request(app)
            .put(rutaOrden(project.id))
            .set('Cookie', cookie)
            .send({ columnIds: columnas.map((c) => c.id).reverse() }),
          request(app).delete(rutaColumna(project.id, enProgreso.id)).set('Cookie', cookie),
        ]);

        expect(respuestas.map((res) => res.status)).toEqual([403, 403, 403, 403]);
        // Nada cambio.
        expect(await nombresDelTablero(project, usuario)).toEqual(NOMBRES_POR_DEFECTO);
      },
    );

    it('sin sesion es 401', async () => {
      const { project } = await createProject();

      const res = await request(app)
        .post(rutaColumnas(project.id))
        .send({ name: 'QA', category: 'TODO' });

      expect(res.status).toBe(401);
    });
  });

  describe('renombrar', () => {
    it('el nuevo nombre se ve en el tablero y en los elementos de la columna', async () => {
      const { project, owner } = await createProject();
      const columnId = (await columnIdOfStatus(project, 'IN_PROGRESS'))!;
      const item = await createWorkItem({ project, createdBy: owner, columnId });

      const res = await request(app)
        .patch(rutaColumna(project.id, columnId))
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'Haciendo' });

      expect(res.status).toBe(200);
      expect(res.body.column).toMatchObject({ id: columnId, name: 'Haciendo', position: 1 });
      const detalle = await request(app)
        .get(`/api/projects/${project.id}/work-items/${item.id}`)
        .set('Cookie', sessionCookie(owner));
      // El puente sigue funcionando: la columna por defecto conserva su estado.
      expect(detalle.body.item).toMatchObject({
        status: 'IN_PROGRESS',
        column: { name: 'Haciendo' },
      });
    });

    it('una columna de otro proyecto es 404', async () => {
      const { project, owner } = await createProject();
      const { project: otro } = await createProject({ owner });
      const ajena = (await columnIdOfStatus(otro, 'TODO'))!;

      const res = await request(app)
        .patch(rutaColumna(project.id, ajena))
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'Robada' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COLUMN_NOT_FOUND');
    });
  });

  describe('reordenar', () => {
    it('el nuevo orden se conserva al recargar', async () => {
      const { project, owner } = await createProject();
      const columnas = await prisma.boardColumn.findMany({
        where: { projectId: project.id },
        orderBy: { position: 'asc' },
      });
      const [porHacer, enProgreso, enRevision, hecho] = columnas;
      const nuevoOrden = [hecho!, porHacer!, enRevision!, enProgreso!];

      const res = await request(app)
        .put(rutaOrden(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnIds: nuevoOrden.map((c) => c.id) });

      expect(res.status).toBe(200);
      expect(
        res.body.columns.map((c: { name: string; position: number }) => [c.name, c.position]),
      ).toEqual([
        ['Hecho', 0],
        ['Por hacer', 1],
        ['En revision', 2],
        ['En progreso', 3],
      ]);
      expect(await nombresDelTablero(project, owner)).toEqual([
        'Hecho',
        'Por hacer',
        'En revision',
        'En progreso',
      ]);
    });

    it('409 si el orden no trae exactamente las columnas del proyecto', async () => {
      const { project, owner } = await createProject();
      const columnas = await prisma.boardColumn.findMany({ where: { projectId: project.id } });

      const res = await request(app)
        .put(rutaOrden(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ columnIds: columnas.slice(1).map((c) => c.id) });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('COLUMN_ORDER_MISMATCH');
      expect(await nombresDelTablero(project, owner)).toEqual(NOMBRES_POR_DEFECTO);
    });
  });

  describe('eliminar', () => {
    it('una columna vacia se elimina (204) y las demas cierran el hueco', async () => {
      const { project, owner } = await createProject();
      const enRevision = (await columnIdOfStatus(project, 'IN_REVIEW'))!;

      const res = await request(app)
        .delete(rutaColumna(project.id, enRevision))
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(204);
      const columnas = await prisma.boardColumn.findMany({
        where: { projectId: project.id },
        orderBy: { position: 'asc' },
      });
      expect(columnas.map((c) => [c.name, c.position])).toEqual([
        ['Por hacer', 0],
        ['En progreso', 1],
        ['Hecho', 2],
      ]);
    });

    it('una columna con elementos y sin destino es 409 y no se toca nada', async () => {
      const { project, owner } = await createProject();
      const enProgreso = (await columnIdOfStatus(project, 'IN_PROGRESS'))!;
      await createWorkItem({ project, createdBy: owner, columnId: enProgreso });

      const res = await request(app)
        .delete(rutaColumna(project.id, enProgreso))
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('COLUMN_NOT_EMPTY');
      expect(await prisma.boardColumn.count({ where: { id: enProgreso } })).toBe(1);
    });

    it('con destino, los elementos pasan ahi y registran ITEM_STATUS_CHANGED', async () => {
      const { project, owner } = await createProject();
      const enProgreso = (await columnIdOfStatus(project, 'IN_PROGRESS'))!;
      const porHacer = (await columnIdOfStatus(project, 'TODO'))!;
      const a = await createWorkItem({ project, createdBy: owner, columnId: enProgreso });
      const b = await createWorkItem({ project, createdBy: owner, columnId: enProgreso });
      const otro = await createWorkItem({ project, createdBy: owner, status: 'DONE' });

      const res = await request(app)
        .delete(rutaColumna(project.id, enProgreso))
        .query({ moveTo: porHacer })
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(204);
      const items = await prisma.workItem.findMany({ where: { id: { in: [a.id, b.id] } } });
      expect(items.map((item) => item.columnId)).toEqual([porHacer, porHacer]);
      const actividad = await prisma.activityLog.findMany({ orderBy: { workItemId: 'asc' } });
      expect(actividad).toHaveLength(2);
      expect(actividad).toEqual(
        expect.arrayContaining(
          [a, b].map((item) =>
            expect.objectContaining({
              action: 'ITEM_STATUS_CHANGED',
              workItemId: item.id,
              actorId: owner.id,
              fromValue: 'IN_PROGRESS',
              toValue: 'TODO',
            }),
          ),
        ),
      );
      // Los elementos de otras columnas no se tocan.
      expect((await prisma.workItem.findUniqueOrThrow({ where: { id: otro.id } })).columnId).toBe(
        await columnIdOfStatus(project, 'DONE'),
      );
    });

    it('rechaza con 400 un destino de otro proyecto', async () => {
      const { project, owner } = await createProject();
      const { project: otro } = await createProject({ owner });
      const enProgreso = (await columnIdOfStatus(project, 'IN_PROGRESS'))!;
      await createWorkItem({ project, createdBy: owner, columnId: enProgreso });

      const res = await request(app)
        .delete(rutaColumna(project.id, enProgreso))
        .query({ moveTo: await columnIdOfStatus(otro, 'TODO') })
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COLUMN_NOT_IN_PROJECT');
    });

    it('tras borrar la columna por defecto, mover por su estado antiguo es 409', async () => {
      const { project, owner } = await createProject();
      const enRevision = (await columnIdOfStatus(project, 'IN_REVIEW'))!;
      const item = await createWorkItem({ project, createdBy: owner, status: 'TODO' });
      await request(app)
        .delete(rutaColumna(project.id, enRevision))
        .set('Cookie', sessionCookie(owner))
        .expect(204);

      const res = await request(app)
        .patch(`/api/projects/${project.id}/work-items/${item.id}/status`)
        .set('Cookie', sessionCookie(owner))
        .send({ status: 'IN_REVIEW' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('STATUS_COLUMN_MISSING');
    });
  });

  describe('siempre queda una columna DONE', () => {
    it('no se puede eliminar la ultima columna DONE (409)', async () => {
      const { project, owner } = await createProject();
      const hecho = (await columnIdOfStatus(project, 'DONE'))!;
      const porHacer = (await columnIdOfStatus(project, 'TODO'))!;

      const res = await request(app)
        .delete(rutaColumna(project.id, hecho))
        .query({ moveTo: porHacer })
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_DONE_COLUMN');
      expect(await prisma.boardColumn.count({ where: { id: hecho } })).toBe(1);
    });

    it('no se puede cambiar la categoria de la ultima columna DONE (409)', async () => {
      const { project, owner } = await createProject();
      const hecho = (await columnIdOfStatus(project, 'DONE'))!;

      const res = await request(app)
        .patch(rutaColumna(project.id, hecho))
        .set('Cookie', sessionCookie(owner))
        .send({ category: 'IN_PROGRESS' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_DONE_COLUMN');
    });

    it('si hay otra columna DONE, la original si se puede eliminar', async () => {
      const { project, owner } = await createProject();
      const hecho = (await columnIdOfStatus(project, 'DONE'))!;
      await request(app)
        .post(rutaColumnas(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'Archivado', category: 'DONE' })
        .expect(201);

      const res = await request(app)
        .delete(rutaColumna(project.id, hecho))
        .set('Cookie', sessionCookie(owner));

      expect(res.status).toBe(204);
    });

    it('dos eliminaciones simultaneas no dejan el proyecto sin columna DONE', async () => {
      const { project, owner } = await createProject();
      const hecho = (await columnIdOfStatus(project, 'DONE'))!;
      const archivado = await request(app)
        .post(rutaColumnas(project.id))
        .set('Cookie', sessionCookie(owner))
        .send({ name: 'Archivado', category: 'DONE' });

      const respuestas = await Promise.all(
        [hecho, archivado.body.column.id as string].map((columnId) =>
          request(app)
            .delete(rutaColumna(project.id, columnId))
            .set('Cookie', sessionCookie(owner)),
        ),
      );

      expect(respuestas.map((res) => res.status).sort()).toEqual([204, 409]);
      expect(
        await prisma.boardColumn.count({ where: { projectId: project.id, category: 'DONE' } }),
      ).toBe(1);
    });
  });
});
