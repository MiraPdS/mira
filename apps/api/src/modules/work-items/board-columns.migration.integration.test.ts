import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * MIR-31: la migracion a columnas sobre datos de la Entrega 1.
 *
 * La suite normal arranca con todas las migraciones ya aplicadas y la base
 * vacia, asi que no puede ver el traspaso de datos. Esta prueba arma su propia
 * base en el mismo Postgres de pruebas y recorre el camino real de produccion:
 *
 *   1. migraciones de la Entrega 1 e insercion de proyectos y elementos en
 *      todos los estados;
 *   2. MIR-43 (sprints) y asignacion de algunos elementos a sprints;
 *   3. MIR-31, verificando que cada elemento quedo en la columna de su estado
 *      anterior y que los datos de sprints no cambiaron.
 *
 * MIR-49: sobre esa misma base aplica despues la migracion que quita el
 * puente, y verifica que el historial pasa de estados a nombres de columna.
 */

const MIGRACION = '20261030120000_mir31_board_columns';
const MIGRACION_SPRINTS = '20261028120000_mir43_sprints';
const MIGRACION_MIR49 = '20261030130000_mir49_drop_legacy_status';
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIGRATIONS_DIR = path.join(API_DIR, 'prisma/migrations');
const BASE = 'mira_test_mir31_migracion';

const urlDeBase = (database: string) => {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
};

/** Ejecuta un archivo de migracion contra la base aislada. */
function aplicar(migracion: string): void {
  execFileSync(
    'npx',
    [
      'prisma',
      'db',
      'execute',
      '--file',
      path.join(MIGRATIONS_DIR, migracion, 'migration.sql'),
      '--url',
      urlDeBase(BASE),
    ],
    { cwd: API_DIR, stdio: 'pipe' },
  );
}

const migraciones = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const anteriores = migraciones.filter((nombre) => nombre < MIGRACION);
const entreMir31yMir49 = migraciones.filter(
  (nombre) => nombre > MIGRACION && nombre < MIGRACION_MIR49,
);
const deEntrega1 = anteriores.filter((nombre) => nombre < MIGRACION_SPRINTS);
const desdeSprints = anteriores.filter((nombre) => nombre >= MIGRACION_SPRINTS);

let admin: PrismaClient;
let db: PrismaClient;

/** Un elemento por estado en cada proyecto, como los dejo la Entrega 1. */
const ESTADOS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

/** Elementos asignados a cada sprint antes de MIR-31 (incluye uno del backlog). */
const EN_SPRINT: Record<string, string[]> = {
  s1: ['p1-DONE', 'p1-IN_REVIEW'],
  s2: ['p1-TODO', 'p1-IN_PROGRESS', 'p1-BACKLOG'],
  s3: ['p2-TODO'],
};

type Fila = Record<string, unknown>;
let sprintsAntes: Fila[];
let elementosAntes: Fila[];

const leerSprints = () =>
  db.$queryRawUnsafe<Fila[]>(
    `SELECT id, "projectId", name, goal, "startDate"::text AS "startDate",
            "endDate"::text AS "endDate", status::text AS status, "createdAt", "updatedAt"
     FROM sprints ORDER BY id`,
  );
/** Todo lo de work_items que MIR-31 no debe tocar. */
const leerElementos = () =>
  db.$queryRawUnsafe<Fila[]>(
    `SELECT id, reference, "projectId", title, "sprintId", "createdById", "createdAt", "updatedAt"
     FROM work_items ORDER BY id`,
  );

beforeAll(async () => {
  admin = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${BASE}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${BASE}"`);

  for (const migracion of deEntrega1) aplicar(migracion);

  db = new PrismaClient({ datasourceUrl: urlDeBase(BASE) });
  await db.$executeRawUnsafe(
    `INSERT INTO users (id, name, email, "passwordHash", "updatedAt")
     VALUES ('u1', 'Ada', 'ada@mira.test', 'x', now())`,
  );
  for (const [projectId, key] of [
    ['p1', 'UNO'],
    ['p2', 'DOS'],
  ]) {
    await db.$executeRawUnsafe(
      `INSERT INTO projects (id, name, key, "updatedAt") VALUES ('${projectId}', '${key}', '${key}', now())`,
    );
    for (const estado of ESTADOS) {
      await db.$executeRawUnsafe(
        `INSERT INTO work_items (id, reference, "projectId", title, status, "createdById", "updatedAt")
         VALUES ('${projectId}-${estado}', '${key}-${estado}', '${projectId}', '${estado}',
                 '${estado}'::"WorkItemStatus", 'u1', now())`,
      );
    }
  }
  // Un proyecto sin elementos tambien recibe sus columnas.
  await db.$executeRawUnsafe(
    `INSERT INTO projects (id, name, key, "updatedAt") VALUES ('p3', 'TRES', 'TRES', now())`,
  );

  // MIR-43 llega con elementos ya creados; luego se planifican sprints.
  for (const migracion of desdeSprints) aplicar(migracion);
  await db.$executeRawUnsafe(
    `INSERT INTO sprints (id, "projectId", name, goal, "startDate", "endDate", status, "updatedAt")
     VALUES ('s1', 'p1', 'Sprint 1', 'Cerrar E1', '2026-10-01', '2026-10-14', 'CLOSED', now()),
            ('s2', 'p1', 'Sprint 2', NULL, '2026-10-15', '2026-10-28', 'ACTIVE', now()),
            ('s3', 'p2', 'Sprint A', NULL, '2026-11-01', '2026-11-14', 'PLANNED', now())`,
  );
  for (const [sprintId, ids] of Object.entries(EN_SPRINT)) {
    await db.$executeRawUnsafe(
      `UPDATE work_items SET "sprintId" = '${sprintId}'
       WHERE id IN (${ids.map((id) => `'${id}'`).join(', ')})`,
    );
  }
  sprintsAntes = await leerSprints();
  elementosAntes = await leerElementos();

  aplicar(MIGRACION);
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await admin?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${BASE}" WITH (FORCE)`);
  await admin?.$disconnect();
});

describe(`migracion ${MIGRACION}`, () => {
  it('crea las cuatro columnas por defecto en cada proyecto existente', async () => {
    const columnas = await db.$queryRawUnsafe<
      Array<{ projectId: string; name: string; position: number; category: string }>
    >(
      `SELECT "projectId", name, position, category::text
       FROM board_columns ORDER BY "projectId", position`,
    );

    for (const projectId of ['p1', 'p2', 'p3']) {
      expect(
        columnas
          .filter((columna) => columna.projectId === projectId)
          .map(({ name, position, category }) => ({ name, position, category })),
      ).toEqual([
        { name: 'Por hacer', position: 0, category: 'TODO' },
        { name: 'En progreso', position: 1, category: 'IN_PROGRESS' },
        { name: 'En revision', position: 2, category: 'IN_PROGRESS' },
        { name: 'Hecho', position: 3, category: 'DONE' },
      ]);
    }
  });

  it('deja cada elemento en la columna de su estado anterior, sin perder ninguno', async () => {
    const filas = await db.$queryRawUnsafe<
      Array<{ id: string; projectId: string; columnProject: string | null; legacy: string | null }>
    >(
      `SELECT w.id, w."projectId", c."projectId" AS "columnProject", c."legacyStatus"::text AS legacy
       FROM work_items w LEFT JOIN board_columns c ON c.id = w."columnId"
       ORDER BY w.id`,
    );

    expect(filas).toHaveLength(ESTADOS.length * 2);
    for (const fila of filas) {
      const estadoAnterior = fila.id.split('-')[1];
      if (estadoAnterior === 'BACKLOG') {
        expect(fila.legacy).toBeNull();
        expect(fila.columnProject).toBeNull();
      } else {
        expect(fila.legacy).toBe(estadoAnterior);
        // La columna es del mismo proyecto que el elemento.
        expect(fila.columnProject).toBe(fila.projectId);
      }
    }
  });

  it('elimina la columna status de work_items', async () => {
    const columnas = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'work_items' AND column_name IN ('status', 'columnId')`,
    );

    expect(columnas.map((c) => c.column_name)).toEqual(['columnId']);
  });

  it('conserva sprints, ids, referencias y asignaciones a sprint', async () => {
    expect(await leerSprints()).toEqual(sprintsAntes);
    expect(await leerElementos()).toEqual(elementosAntes);
    expect(sprintsAntes).toHaveLength(3);
    expect(elementosAntes.filter((fila) => fila.sprintId !== null)).toHaveLength(6);
  });

  it('mantiene las dos relaciones de work_items: sprint y columna del mismo proyecto', async () => {
    const llaves = await db.$queryRawUnsafe<Array<{ conname: string; definicion: string }>>(
      `SELECT conname, pg_get_constraintdef(oid) AS definicion FROM pg_constraint
       WHERE conrelid = 'work_items'::regclass AND contype = 'f'
         AND conname IN ('work_items_sprintId_fkey', 'work_items_columnId_projectId_fkey')
       ORDER BY conname`,
    );

    expect(llaves).toEqual([
      {
        conname: 'work_items_columnId_projectId_fkey',
        definicion: expect.stringContaining('REFERENCES board_columns(id, "projectId")'),
      },
      {
        conname: 'work_items_sprintId_fkey',
        definicion: expect.stringContaining('ON DELETE SET NULL'),
      },
    ]);
  });

  it('borrar un sprint conserva sus elementos y la columna de cada uno', async () => {
    const antes = await db.$queryRawUnsafe<Array<{ id: string; columnId: string | null }>>(
      `SELECT id, "columnId" FROM work_items WHERE "sprintId" = 's2' ORDER BY id`,
    );
    expect(antes).toHaveLength(EN_SPRINT.s2!.length);

    await db.$executeRawUnsafe(`DELETE FROM sprints WHERE id = 's2'`);

    const despues = await db.$queryRawUnsafe<
      Array<{ id: string; columnId: string | null; sprintId: string | null }>
    >(
      `SELECT id, "columnId", "sprintId" FROM work_items
       WHERE id IN (${antes.map((fila) => `'${fila.id}'`).join(', ')}) ORDER BY id`,
    );
    expect(despues).toEqual(antes.map((fila) => ({ ...fila, sprintId: null })));
  });
});

describe(`migracion ${MIGRACION_MIR49}`, () => {
  beforeAll(async () => {
    // Historial como lo dejaba el puente: estado antiguo en las columnas por
    // defecto, nombre en las creadas despues, BACKLOG sin columna. Un
    // ITEM_UPDATED con un valor parecido no es un movimiento y no se toca.
    const movimientos = [
      ['a1', 'ITEM_STATUS_CHANGED', 'status', 'BACKLOG', 'TODO'],
      ['a2', 'ITEM_STATUS_CHANGED', 'status', 'TODO', 'IN_PROGRESS'],
      ['a3', 'ITEM_STATUS_CHANGED', 'status', 'IN_REVIEW', 'DONE'],
      ['a4', 'ITEM_STATUS_CHANGED', 'status', 'DONE', 'Bloqueado'],
      ['a5', 'ITEM_UPDATED', 'title', 'TODO', 'DONE'],
    ];
    for (const [id, action, field, fromValue, toValue] of movimientos) {
      await db.$executeRawUnsafe(
        `INSERT INTO activity_log (id, action, "projectId", "workItemId", "actorId", field, "fromValue", "toValue")
         VALUES ('${id}', '${action}'::"ActivityAction", 'p1', 'p1-TODO', 'u1', '${field}', '${fromValue}', '${toValue}')`,
      );
    }

    for (const migracion of entreMir31yMir49) aplicar(migracion);
    aplicar(MIGRACION_MIR49);
  }, 120_000);

  it('traduce el historial de estados a los nombres de las columnas por defecto', async () => {
    const filas = await db.$queryRawUnsafe<
      Array<{ id: string; fromValue: string; toValue: string }>
    >(`SELECT id, "fromValue", "toValue" FROM activity_log ORDER BY id`);

    expect(filas).toEqual([
      { id: 'a1', fromValue: 'BACKLOG', toValue: 'Por hacer' },
      { id: 'a2', fromValue: 'Por hacer', toValue: 'En progreso' },
      { id: 'a3', fromValue: 'En revision', toValue: 'Hecho' },
      { id: 'a4', fromValue: 'Hecho', toValue: 'Bloqueado' },
      { id: 'a5', fromValue: 'TODO', toValue: 'DONE' },
    ]);
  });

  it('quita legacyStatus y el enum WorkItemStatus sin tocar las columnas', async () => {
    const legacy = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'board_columns' AND column_name = 'legacyStatus'`,
    );
    const enums = await db.$queryRawUnsafe<Array<{ typname: string }>>(
      `SELECT typname FROM pg_type WHERE typname = 'WorkItemStatus'`,
    );
    const [conteo] = await db.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM work_items WHERE "columnId" IS NOT NULL`,
    );

    expect(legacy).toEqual([]);
    expect(enums).toEqual([]);
    expect(conteo?.total).toBe(8);
  });
});
