import { defineConfig } from 'vitest/config';

/**
 * Configuracion raiz del monorepo.
 *
 * Agrupa los cuatro proyectos de prueba para que `npm test` en la raiz corra
 * TODO y emita UN solo reporte de cobertura (es la evidencia que pide la
 * rubrica).  Cada proyecto mantiene ademas su propio config para que un dev
 * pueda correr solo lo suyo mientras desarrolla.
 *
 *   shared           -> logica pura (permisos, esquemas Zod).  Node, instantaneo.
 *   api-unit         -> services con Prisma mockeado.          Node, sin BD.
 *   api-integration  -> rutas via Supertest contra Postgres real (puerto 5443).
 *   web              -> componentes con RTL + MSW.             jsdom.
 *
 * Comandos utiles:
 *   npm run test:unit          todo menos la suite lenta de integracion
 *   npm run test:integration   solo integracion (requiere `npm run db:up`)
 */
export default defineConfig({
  test: {
    projects: [
      './packages/shared/vitest.config.ts',
      './apps/api/vitest.unit.config.ts',
      './apps/api/vitest.integration.config.ts',
      './apps/web/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/*.d.ts',
        '**/index.ts',
        'apps/web/src/main.tsx',
        'apps/api/src/server.ts',
      ],
      // Sin `thresholds` a proposito: en E1 la cobertura se REPORTA como
      // evidencia pero no rompe el build.  Se activa el umbral en E2, cuando
      // ya existe una linea base real que defender.
    },
  },
});
