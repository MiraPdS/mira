import { test as base } from '@playwright/test';
import { crearProyectoPropio, type ProyectoPropio } from './proyecto';

/**
 * Punto de entrada de las specs (D8.7): importar SIEMPRE desde aqui.
 *
 *   import { test, expect, usuarios } from '../fixtures';
 */
export const test = base.extend<{ proyectoPropio: ProyectoPropio }>({
  proyectoPropio: async ({ page }, use, testInfo) => {
    await use(await crearProyectoPropio(page, testInfo));
  },
});

export { expect } from '@playwright/test';
export { sinSesion, usuarios, type UsuarioSeed } from './usuarios';
export type { ProyectoPropio } from './proyecto';
