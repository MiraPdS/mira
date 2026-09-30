import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Configuracion de pruebas del frontend.
 *
 * Se declara el plugin y el alias en vez de fusionar vite.config.ts con
 * mergeConfig: la fusion pierde el tipado de `plugins` y lo unico que estas
 * pruebas necesitan de la config de Vite son justamente estas dos cosas.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
