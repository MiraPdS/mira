import { randomInt } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test, usuarios } from '../fixtures';

/**
 * MIR-65 · E2E de proyectos y permisos (MIR-5, MIR-6, MIR-7, MIR-50, D7).
 *
 * Crear proyectos corre como ada con claves aleatorias: no toca el proyecto
 * MIR del seed.  Los permisos solo leen MIR: grace es VIEWER y ada OWNER.
 *
 * Cada "no ve X" de grace tiene su contraprueba con ada: si un selector deja
 * de encontrar el botón, falla el control en vez de pasar el "no ve".
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
 * Abre el backlog y espera a que la página termine de cargar el proyecto (y
 * con él el rol): "Cargando proyecto..." desaparece en el mismo render que
 * decide si se muestra "+ Crear elemento".
 */
async function abrirBacklog(page: Page, id: string): Promise<void> {
  await page.goto(`/proyectos/${id}/backlog`);
  await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
  await expect(page.getByText('Cargando proyecto...')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

/**
 * Llega al tablero navegando dentro de la app desde el backlog, que ya cargó
 * el proyecto: el tablero se monta con el rol en la caché de React Query y
 * "+ Crear elemento" se decide en su primer render.  Termina con las
 * columnas visibles.
 */
async function abrirTablero(page: Page, id: string): Promise<void> {
  await abrirBacklog(page, id);
  await page.getByRole('link', { name: /volver al proyecto/i }).click();
  await page.getByRole('link', { name: /ver tablero/i }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/tablero$`));
  await expect(page.getByRole('region', { name: 'Columnas del tablero' })).toBeVisible();
}

/**
 * Abre la configuración y espera el aviso o la acción que dependen del rol:
 * para VIEWER el texto de solo lectura, para OWNER el botón "Editar".
 */
async function abrirConfiguracion(page: Page, id: string): Promise<void> {
  await page.goto(`/proyectos/${id}/configuracion`);
  await expect(
    page.getByRole('heading', { name: 'Configuracion del proyecto', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Columnas en el orden del tablero' })).toBeVisible();
}

/** Vuelve a "Mis proyectos" y comprueba que no hay un proyecto con ese nombre. */
async function noExisteProyecto(page: Page, nombre: string): Promise<void> {
  await page.goto('/proyectos');
  await expect(page.getByRole('link', { name: 'Plataforma Mira', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: nombre, exact: true })).toHaveCount(0);
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
    const nombre = 'E2E Clave invalida';

    await page.goto('/proyectos/nuevo');
    await page.getByLabel('Nombre', { exact: true }).fill(nombre);
    await page.getByLabel('Clave', { exact: true }).fill('1ABC');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();

    await expect(
      page.getByText('La clave debe empezar con letra y usar solo letras y numeros'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/proyectos\/nuevo$/);

    await noExisteProyecto(page, nombre);
  });

  test('una clave que ya existe muestra su error y no crea nada', async ({ page }) => {
    const nombre = 'E2E Clave duplicada';

    await page.goto('/proyectos/nuevo');
    await page.getByLabel('Nombre', { exact: true }).fill(nombre);
    await page.getByLabel('Clave', { exact: true }).fill('MIR');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();

    await expect(page.getByText('Ya existe un proyecto con la clave MIR')).toBeVisible();
    await expect(page).toHaveURL(/\/proyectos\/nuevo$/);

    await noExisteProyecto(page, nombre);
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

  test('grace no ve "Crear elemento" en el backlog', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirBacklog(page, id);
    await expect(page.getByRole('button', { name: /crear elemento/i })).toHaveCount(0);
  });

  test('grace no ve "Crear elemento" en el tablero', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirTablero(page, id);
    await expect(page.getByRole('button', { name: /crear elemento/i })).toHaveCount(0);
  });

  test('grace no puede editar el proyecto ni configurar sus columnas', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirConfiguracion(page, id);
    // El texto de solo lectura sale del rol: confirma que ya se resolvió.
    await expect(
      page.getByText('Solo el propietario del proyecto puede modificarlas.'),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /agregar columna/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(editar|eliminar) columna/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(subir|bajar) /i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar proyecto' })).toHaveCount(0);
  });
});

test.describe('MIR-65 · Control: OWNER sí ve las acciones', () => {
  test('ada ve "Crear elemento" en el backlog', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirBacklog(page, id);
    await expect(page.getByRole('button', { name: /crear elemento/i })).toBeVisible();
  });

  test('ada ve "Crear elemento" en el tablero', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirTablero(page, id);
    await expect(page.getByRole('button', { name: /crear elemento/i })).toBeVisible();
  });

  test('ada ve las acciones de edición del proyecto y de sus columnas', async ({ page }) => {
    const id = await idDeMir(page);

    await abrirConfiguracion(page, id);
    await expect(page.getByText('Define las etapas del tablero y su orden.')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /agregar columna/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^editar columna/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^eliminar columna/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^(subir|bajar) /i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar proyecto' })).toBeVisible();
  });
});
