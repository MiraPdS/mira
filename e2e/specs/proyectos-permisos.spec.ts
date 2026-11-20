import { randomInt } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test, usuarios } from '../fixtures';

/**
 * MIR-65 · E2E de proyectos y permisos (MIR-5, MIR-6, MIR-7, MIR-50, D7).
 *
 * Crear proyectos corre como ada con claves aleatorias: no toca el proyecto
 * MIR del seed.  Los permisos solo leen MIR: grace es VIEWER y ada OWNER.
 */

const ALFANUMERICO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Clave válida y única: 'P' + 6 caracteres (2 a 8, empieza con letra). */
function claveNueva(): string {
  let clave = 'P';
  for (let i = 0; i < 6; i++) clave += ALFANUMERICO[randomInt(ALFANUMERICO.length)];
  return clave;
}

/** Id del proyecto MIR del seed, leído con la sesión del test. */
async function idDeMir(page: Page): Promise<string> {
  const respuesta = await page.request.get('/api/projects');
  expect(respuesta.ok()).toBe(true);
  const { projects } = (await respuesta.json()) as { projects: { id: string; key: string }[] };
  const mir = projects.find((proyecto) => proyecto.key === 'MIR');
  if (!mir) throw new Error('El seed no tiene el proyecto MIR');
  return mir.id;
}

/**
 * Navega y espera a que llegue el proyecto (con el rol del usuario) antes de
 * afirmar que algo NO se ve: sin esto, un botón ausente porque la página aún
 * no carga daría un falso verde.
 */
async function abrirConProyecto(page: Page, id: string, ruta: string): Promise<void> {
  const proyecto = page.waitForResponse(
    (r) => r.url().endsWith(`/api/projects/${id}`) && r.request().method() === 'GET' && r.ok(),
  );
  await page.goto(`/proyectos/${id}${ruta}`);
  await proyecto;
}

test.describe('MIR-65 · Crear proyecto', () => {
  test('una clave válida crea el proyecto y aparece en la lista como propietario', async ({
    page,
  }) => {
    const clave = claveNueva();
    const nombre = `E2E Proyecto ${clave}`;

    await page.goto('/proyectos');
    await page.getByRole('link', { name: 'Nuevo proyecto' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill(nombre);
    await page.getByLabel('Clave', { exact: true }).fill(clave);
    await page.getByRole('button', { name: 'Crear proyecto' }).click();

    await expect(page).toHaveURL(/\/proyectos$/);
    const tarjeta = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: nombre, exact: true }) });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText(clave);
    await expect(tarjeta).toContainText('Propietario');
  });

  test('una clave con formato inválido muestra su error y no crea nada', async ({ page }) => {
    await page.goto('/proyectos/nuevo');
    await page.getByLabel('Nombre', { exact: true }).fill('E2E Clave invalida');
    await page.getByLabel('Clave', { exact: true }).fill('1ABC');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();

    await expect(
      page.getByText('La clave debe empezar con letra y usar solo letras y numeros'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/proyectos\/nuevo$/);
  });

  test('una clave que ya existe muestra su error y no crea nada', async ({ page }) => {
    await page.goto('/proyectos/nuevo');
    await page.getByLabel('Nombre', { exact: true }).fill('E2E Clave duplicada');
    await page.getByLabel('Clave', { exact: true }).fill('MIR');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();

    await expect(page.getByText('Ya existe un proyecto con la clave MIR')).toBeVisible();
    await expect(page).toHaveURL(/\/proyectos\/nuevo$/);
  });
});

test.describe('MIR-65 · Permisos de VIEWER', () => {
  test.use({ storageState: usuarios.grace.storage });

  test('grace ve MIR como Observador en su lista de proyectos', async ({ page }) => {
    await page.goto('/proyectos');

    const tarjeta = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: 'Plataforma Mira', exact: true }) });
    await expect(tarjeta).toContainText('Observador');
  });

  test('grace no ve "Crear elemento" en el backlog ni en el tablero', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirConProyecto(page, id, '/backlog');
    await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /crear elemento/i })).toHaveCount(0);

    await abrirConProyecto(page, id, '/tablero');
    await expect(page.getByRole('button', { name: /crear elemento/i })).toHaveCount(0);
  });

  test('grace no puede editar el proyecto ni configurar sus columnas', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirConProyecto(page, id, '/configuracion');
    await expect(
      page.getByRole('heading', { name: 'Configuracion del proyecto', level: 1 }),
    ).toBeVisible();
    // El texto de solo lectura confirma que ya se resolvió el rol.
    await expect(
      page.getByText('Solo el propietario del proyecto puede modificarlas.'),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /agregar columna/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(editar|eliminar) columna/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar proyecto' })).toHaveCount(0);
  });
});

test.describe('MIR-65 · Control: OWNER sí ve las acciones', () => {
  // Contraprueba de los tests de grace: si los selectores dejaran de
  // encontrar los botones, los "no ve" pasarían por error.
  test('ada ve Crear elemento, Editar y Agregar columna en MIR', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirConProyecto(page, id, '/backlog');
    await expect(page.getByRole('button', { name: /crear elemento/i })).toBeVisible();

    await abrirConProyecto(page, id, '/configuracion');
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /agregar columna/i })).toBeVisible();
  });
});
