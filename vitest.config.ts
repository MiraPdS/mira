import { defineConfig } from 'vitest/config';

/**
 * Configuracion raiz del monorepo.
 *
 * Agrupa los cuatro proyectos de prueba para que `npm test` en la raiz corra
 * TODO y emita UN solo reporte de cobertura (es la evidencia que pide la
 * rubrica) y aplique UN solo umbral (MIR-55).  Cada proyecto mantiene ademas
 * su propio config para que un dev pueda correr solo lo suyo mientras
 * desarrolla.
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
      // MIR-55: umbral bloqueante desde la Entrega 2.  Si la cobertura baja de
      // estos valores, `npm run test:coverage` termina con error y el pipeline
      // queda rojo.  GitHub Actions ya corre ese comando; el Jenkinsfile
      // (MIR-51) debe correr el mismo y propagar su codigo de salida.
      //
      // Linea base: CI de develop al inicio de la entrega (35308c1, merge de
      // MIR-43): 97,18 % sentencias y lineas, 97,9 % funciones, 89,33 % ramas.
      // Services y hooks estaban en 100 % (ramas >= 97,9 % y >= 88,9 %).
      //
      // Regla: linea base redondeada hacia abajo, menos ~2 puntos.  El margen
      // absorbe el codigo nuevo de la entrega; una caida real rompe el build.
      // Si la cobertura sube, se sube el umbral; nunca se baja para que pase
      // un PR.  Justificacion completa en docs/estrategia-pruebas.md (seccion 4).
      thresholds: {
        statements: 95,
        branches: 87,
        functions: 95,
        lines: 95,
        // Logica de negocio y permisos de la API.
        'apps/api/src/modules/**/*.service.ts': {
          statements: 98,
          branches: 95,
          functions: 98,
          lines: 98,
        },
        // Estado de servidor y cache de la web (TanStack Query).
        'apps/web/src/features/**/use*.ts': {
          statements: 98,
          branches: 85,
          functions: 98,
          lines: 98,
        },
      },
    },
  },
});
