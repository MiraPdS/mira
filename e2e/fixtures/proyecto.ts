import { randomInt } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';

export interface ProyectoPropio {
  id: string;
  key: string;
  name: string;
  /** Ruta del backlog del proyecto, lista para `page.goto(proyecto.url)`. */
  url: string;
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Clave unica que cumple projectKeySchema (2-8, empieza con letra,
 * alfanumerica): 'E' + 7 caracteres base36, ~7,8e10 combinaciones (D5).
 */
export function claveAleatoria(): string {
  let clave = 'E';
  for (let i = 0; i < 7; i++) clave += ALFABETO[randomInt(ALFABETO.length)];
  return clave;
}

/**
 * Crea por API un proyecto nuevo cuyo OWNER es el usuario de la sesion del
 * test (page.request comparte las cookies del storageState).  Sin teardown:
 * el globalSetup resetea la base en cada ejecucion.
 */
export async function crearProyectoPropio(page: Page, testInfo: TestInfo): Promise<ProyectoPropio> {
  const name = `E2E ${testInfo.title}`.slice(0, 120);
  const key = claveAleatoria();

  const respuesta = await page.request.post('/api/projects', { data: { name, key } });
  if (respuesta.status() !== 201) {
    throw new Error(
      `proyectoPropio: POST /api/projects respondio ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }

  const { project } = (await respuesta.json()) as {
    project: { id: string; key: string; name: string };
  };
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    url: `/proyectos/${project.id}/backlog`,
  };
}
