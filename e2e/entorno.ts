/**
 * Variables de entorno de los E2E, en un solo lugar.  Las leen la config,
 * el globalSetup y los fixtures.
 */

export const ES_CI = !!process.env.CI;

/**
 * Si BASE_URL viene definida desde afuera (la demo en MIR-72, o servidores
 * que ya levantaste), Playwright no arranca nada y el globalSetup NO resetea
 * la base: jamas se borra un ambiente que no levantamos nosotros (D3).
 */
export const SERVIDOR_EXTERNO = !!process.env.BASE_URL;

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * BASE_URL apunta a un host que no es esta maquina (la demo publica, MIR-72).
 * La config entonces solo corre los tests `@humo`, de solo lectura, y sin el
 * proyecto `mobile`: ninguna spec que escribe datos llega a un ambiente que
 * nadie resetea, venga de donde venga el comando (D1 de MIR-72).
 */
export const AMBIENTE_REMOTO = SERVIDOR_EXTERNO && !HOSTS_LOCALES.has(new URL(BASE_URL).hostname);

/** Puerto de la API de E2E: distinto del 3000 de desarrollo (D3). */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);

/**
 * Base propia de los E2E en el Postgres de pruebas (5443), separada de
 * mira_dev y de mira_test (D1).  `migrate reset` la crea si no existe.
 */
export const DATABASE_URL_E2E =
  process.env.E2E_DATABASE_URL ?? 'postgresql://mira:mira@localhost:5443/mira_e2e?schema=public';
