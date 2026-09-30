import { defineConfig } from 'vitest/config';

/**
 * Tests de integracion: Supertest contra la app Express real, golpeando el
 * Postgres de pruebas (puerto 5443, levantado con `npm run db:up`).
 *
 * fileParallelism en false y un solo fork: todos los archivos comparten la
 * misma base y cada test hace TRUNCATE en beforeEach.  Si corrieran en
 * paralelo se borrarian los datos entre si.
 */
export default defineConfig({
  test: {
    name: 'api-integration',
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/setup-integration.ts'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
