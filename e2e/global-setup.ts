import { execSync } from 'node:child_process';
import path from 'node:path';
import { DATABASE_URL_E2E, SERVIDOR_EXTERNO } from './entorno';

/**
 * Deja mira_e2e en el estado inicial conocido una vez por ejecucion (D1):
 * `migrate reset` borra el schema, aplica las migraciones y corre el seed
 * (ada, alan, grace y el proyecto MIR).
 *
 * Contra un servidor externo (BASE_URL definida) no hace nada: ese ambiente
 * no es nuestro y su base no se toca.
 */
export default function globalSetup(): void {
  if (SERVIDOR_EXTERNO) return;

  // Defensa extra: solo se resetea una base cuyo nombre termina en _e2e.
  const base = new URL(DATABASE_URL_E2E).pathname.slice(1);
  if (!base.endsWith('_e2e')) {
    throw new Error(`globalSetup se nego a resetear "${base}": solo resetea bases *_e2e.`);
  }

  execSync('npx prisma migrate reset --force', {
    cwd: path.resolve(import.meta.dirname, '../apps/api'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: DATABASE_URL_E2E, DIRECT_URL: DATABASE_URL_E2E },
  });
}
