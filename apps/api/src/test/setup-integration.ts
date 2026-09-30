import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/**
 * Preparacion de la suite de INTEGRACION.
 *
 * Orden importante: primero se fija el entorno y recien despues se importan
 * los modulos que leen `env` (por eso el import de reset-db es dinamico y
 * vive dentro de beforeAll).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'secreto-de-pruebas-suficientemente-largo-1234567890';
process.env.BCRYPT_ROUNDS ??= '4';
process.env.TEST_DATABASE_URL ??= 'postgresql://mira:mira@localhost:5443/mira_test?schema=public';

// El CLI de Prisma solo lee DATABASE_URL/DIRECT_URL: para migrar la base de
// pruebas hay que apuntarlas ahi. El cliente en runtime usa TEST_DATABASE_URL.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;

/** Raiz de apps/api, calculada desde este archivo (src/test/ -> ../..). */
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let resetDb: () => Promise<void>;
let disconnectDb: () => Promise<void>;

beforeAll(async () => {
  // Aplica las migraciones a la base de pruebas. Es idempotente: si ya estan
  // aplicadas no hace nada, asi que en corridas sucesivas el costo es minimo.
  try {
    // cwd explicito: la suite se puede invocar desde la raiz del monorepo
    // (npm test) o desde apps/api, y el CLI de Prisma busca el schema
    // relativo al directorio actual.
    execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env, cwd: API_DIR });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(
      'No se pudo preparar la base de pruebas.\n' +
        'Verifica que el contenedor este arriba con:  npm run db:up\n' +
        `Detalle: ${detalle}`,
    );
  }

  ({ resetDb, disconnectDb } = await import('./reset-db.js'));
});

// Cada test arranca con la base vacia: nadie hereda datos de nadie.
beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb?.();
});
