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
 * base en el mismo Postgres de pruebas: aplica las migraciones ANTERIORES a
 * MIR-31, inserta proyectos y elementos en todos los estados, aplica MIR-31 y
 * verifica que cada elemento quedo en la columna de su estado anterior.
 */

const MIGRACION = '20261028120000_mir31_board_columns';
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

const anteriores = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name < MIGRACION)
  .map((entry) => entry.name)
  .sort();

let admin: PrismaClient;
let db: PrismaClient;

/** Un elemento por estado en cada proyecto, como los dejo la Entrega 1. */
const ESTADOS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

beforeAll(async () => {
  admin = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${BASE}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${BASE}"`);

  for (const migracion of anteriores) aplicar(migracion);

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
});
