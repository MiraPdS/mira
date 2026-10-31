import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma.js';

const sql = readFileSync(
  new URL(
    '../../../prisma/migrations/20261030220000_mir46_sprint_lifecycle/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
describe('MIR-46 migracion real sobre datos anteriores', () => {
  it('conserva estados y datos, sin inventar snapshot ni default para cierres heredados', async () => {
    await prisma.$transaction(async (tx) => {
      // Tabla temporal que reproduce el contrato anterior; no toca datos publicos.
      await tx.$executeRawUnsafe(
        `CREATE TEMP TABLE sprints (id text PRIMARY KEY, name text NOT NULL, status "SprintStatus" NOT NULL) ON COMMIT DROP`,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO sprints VALUES ('p','Planificado','PLANNED'),('a','Activo','ACTIVE'),('c','Cierre anterior','CLOSED')`,
      );
      for (const statement of sql
        .replace(/BEGIN;|COMMIT;/g, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.$executeRawUnsafe(statement);
      expect(await tx.$queryRawUnsafe(`SELECT * FROM sprints ORDER BY id`)).toEqual([
        { id: 'a', name: 'Activo', status: 'ACTIVE', committedPoints: null, completedPoints: null },
        {
          id: 'c',
          name: 'Cierre anterior',
          status: 'CLOSED',
          committedPoints: null,
          completedPoints: null,
        },
        {
          id: 'p',
          name: 'Planificado',
          status: 'PLANNED',
          committedPoints: null,
          completedPoints: null,
        },
      ]);
      await tx.$executeRawUnsafe(
        `UPDATE sprints SET status='CLOSED', "committedPoints"=8,"completedPoints"=5 WHERE id='a'`,
      );
      expect(
        await tx.$queryRawUnsafe(
          `SELECT "committedPoints", "completedPoints" FROM sprints WHERE id='a'`,
        ),
      ).toEqual([{ committedPoints: 8, completedPoints: 5 }]);
    });
  });
});
