import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { API_PORT, BASE_URL, DATABASE_URL_E2E, ES_CI, SERVIDOR_EXTERNO } from './entorno';
import { usuarios } from './fixtures/usuarios';

/**
 * Configuracion de los E2E de Mira (MIR-61).  Decisiones en
 * docs/plans/MIR-61-andamiaje-playwright.md (D1-D9).
 *
 *   npm run test:e2e          levanta API (:3100) + web (:4173) y corre todo
 *   BASE_URL=https://… npm run test:e2e   corre contra un ambiente ya
 *                             levantado: no arranca servidores ni resetea BD
 */

const raiz = path.resolve(import.meta.dirname, '..');

// API de E2E: puerto y base propios (D1, D3) para no reutilizar por error la
// API de desarrollo conectada a mira_dev.  El .env de la raiz se sigue
// cargando, pero dotenv no pisa lo que se define aqui.
const entornoApi = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  DATABASE_URL: DATABASE_URL_E2E,
  DIRECT_URL: DATABASE_URL_E2E,
  CORS_ORIGIN: BASE_URL,
  // Valor solo para pruebas; en CI puede venir de afuera.
  JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-secreto-local-solo-para-pruebas-0123456789',
};

const comandoApi = ES_CI ? 'node dist/server.js' : 'npx tsx src/server.ts';

// Build sin VITE_API_URL: el bundle llama a /api relativo y el proxy de
// `vite preview` lo lleva a la API de E2E (D2).  En CI el `dist` ya viene del
// job de build.
const comandoWeb = [
  ...(ES_CI ? [] : ['npm run build -w @mira/web']),
  'npm run preview -w @mira/web -- --port 4173 --strictPort',
].join(' && ');

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results', // e2e/test-results: NUNCA el test-results/ de la raiz (JUnit de Vitest)
  globalSetup: './global-setup.ts',

  fullyParallel: true,
  forbidOnly: ES_CI,
  retries: 0, // un test intermitente es un Bug en MIR-74, no un reintento
  workers: ES_CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: ES_CI ? 'never' : 'on-failure' }],
    ['junit', { outputFile: 'reportes/junit-e2e.xml' }],
  ],

  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: 'chromium',
      testMatch: /specs\/.*\.spec\.ts$/,
      grepInvert: /@solo-movil/,
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        storageState: usuarios.ada.storage,
      },
    },
    {
      name: 'mobile',
      testMatch: /specs\/.*\.spec\.ts$/,
      grep: /@movil/,
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        storageState: usuarios.ada.storage,
      },
    },
  ],

  webServer: SERVIDOR_EXTERNO
    ? undefined
    : [
        {
          name: 'API',
          command: comandoApi,
          cwd: path.join(raiz, 'apps/api'),
          // Puerto y no /api/health: Playwright espera al webServer ANTES del
          // globalSetup, y el health consulta una base que el globalSetup
          // todavia no creo (la primera vez, mira_e2e no existe).
          port: API_PORT,
          env: entornoApi,
          reuseExistingServer: !ES_CI,
          timeout: 60_000,
        },
        {
          name: 'Web',
          command: comandoWeb,
          cwd: raiz,
          url: BASE_URL,
          env: { E2E_API_PORT: String(API_PORT), VITE_API_URL: '' },
          // Nunca se reutiliza: un `npm run preview` manual en :4173 reenvia
          // /api a la API de desarrollo (:3000), y los tests escribirian en
          // mira_dev.  Si el puerto esta ocupado, Playwright falla y lo dice.
          // Para correr contra servidores propios: BASE_URL.
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ],
});
