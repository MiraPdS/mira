import { defineConfig } from 'vitest/config';

/**
 * Tests unitarios del backend: services con el repositorio mockeado.
 * No tocan Postgres, no abren sockets: deben correr en milisegundos y poder
 * ejecutarse en cualquier maquina sin Docker.
 */
export default defineConfig({
  test: {
    name: 'api-unit',
    environment: 'node',
    setupFiles: ['./src/test/setup-env.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
});
