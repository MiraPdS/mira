import type { Page } from '@playwright/test';
import { expect, test, type ProyectoPropio } from '../fixtures';

/**
 * MIR-69: E2E de las columnas configurables (MIR-48 a MIR-50).
 *
 * El reorden usa los botones "Subir"/"Bajar" de la configuracion (no
 * arrastre). Todo corre como ada, OWNER de su proyectoPropio.
 */

interface Columna {
  id: string;
  name: string;
  position: number;
}

/** Orden inicial de las columnas de todo proyecto nuevo. */
const POR_DEFECTO = ['Por hacer', 'En progreso', 'En revision', 'Hecho'];

/** Nombres de las columnas del tablero, en el orden en que se pintan. */
const encabezadosDelTablero = (page: Page) =>
  page.getByTestId('columna-tablero').getByRole('heading', { level: 3 });

/** Los encabezados incluyen el contador ("Por hacer" + "Cantidad: 0"). */
const empiezaCon = (nombre: string) =>
  new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*Cantidad: \\d+$`);

const tarjetasDe = (page: Page, columna: string) =>
  page.getByRole('list', { name: `Tarjetas de ${columna}` });

/** Abre el formulario "Agregar columna", la crea y espera la respuesta de la API. */
async function agregarColumna(page: Page, nombre: string) {
  await page.getByRole('button', { name: '+ Agregar columna' }).click();
  const formulario = page.getByRole('form', { name: 'Agregar columna' });
  await formulario.getByLabel('Nombre').fill(nombre);

  const creada = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/columns'),
  );
  await formulario.getByRole('button', { name: 'Agregar' }).click();
  expect((await creada).status()).toBe(201);
  await expect(formulario).toBeHidden();
}

/** Sube una columna un lugar y espera el PUT del nuevo orden. */
async function subirColumna(page: Page, nombre: string) {
  const reordenada = page.waitForResponse(
    (r) => r.request().method() !== 'GET' && r.url().includes('/columns/'),
  );
  await page.getByRole('button', { name: `Subir ${nombre}` }).click();
  expect((await reordenada).status()).toBe(200);
}

async function crearElementoEn(
  page: Page,
  proyecto: ProyectoPropio,
  title: string,
  columna: string,
) {
  const respuestaColumnas = await page.request.get(`/api/projects/${proyecto.id}/columns`);
  expect(respuestaColumnas.status()).toBe(200);
  const { columns } = (await respuestaColumnas.json()) as { columns: Columna[] };
  const destino = columns.find((c) => c.name === columna);
  if (!destino) throw new Error(`No existe la columna ${columna}`);

  const respuesta = await page.request.post(`/api/projects/${proyecto.id}/work-items`, {
    data: { title, columnId: destino.id },
  });
  expect(respuesta.status()).toBe(201);
}

test.describe('MIR-50 · Configurar columnas', () => {
  test('agregar una columna y subirla se refleja en el tablero y persiste al recargar', async ({
    page,
    proyectoPropio,
  }) => {
    const nombre = 'Revision QA';
    await page.goto(`/proyectos/${proyectoPropio.id}/configuracion`);

    const lista = page.getByRole('list', { name: 'Columnas en el orden del tablero' });
    await expect(lista.getByRole('heading', { level: 3 })).toHaveText(POR_DEFECTO);

    await agregarColumna(page, nombre);
    await expect(lista.getByRole('heading', { level: 3 })).toHaveText([...POR_DEFECTO, nombre]);

    // Queda al final; la subimos dos lugares: antes de "Hecho" y de "En revision".
    await subirColumna(page, nombre);
    await subirColumna(page, nombre);
    const esperado = ['Por hacer', 'En progreso', nombre, 'En revision', 'Hecho'];
    await expect(lista.getByRole('heading', { level: 3 })).toHaveText(esperado);

    await page.goto(`/proyectos/${proyectoPropio.id}/tablero`);
    await expect(encabezadosDelTablero(page)).toHaveText(esperado.map(empiezaCon));

    await page.reload();
    await expect(encabezadosDelTablero(page)).toHaveText(esperado.map(empiezaCon));
  });

  test('una columna sin nombre se rechaza y no se crea', async ({ page, proyectoPropio }) => {
    await page.goto(`/proyectos/${proyectoPropio.id}/configuracion`);

    await page.getByRole('button', { name: '+ Agregar columna' }).click();
    const formulario = page.getByRole('form', { name: 'Agregar columna' });
    await formulario.getByRole('button', { name: 'Agregar' }).click();

    await expect(
      formulario.getByText('El nombre de la columna no puede estar vacio'),
    ).toBeVisible();
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(
      page
        .getByRole('list', { name: 'Columnas en el orden del tablero' })
        .getByRole('heading', { level: 3 }),
    ).toHaveText(POR_DEFECTO);
  });
});

test.describe('MIR-50 · Eliminar columna con elementos', () => {
  test('eliminar una columna con elementos pide un destino y mueve las tarjetas', async ({
    page,
    proyectoPropio,
  }) => {
    const titulo = 'Tarjeta que cambia de casa';
    await crearElementoEn(page, proyectoPropio, titulo, 'En revision');

    await page.goto(`/proyectos/${proyectoPropio.id}/tablero`);
    await expect(tarjetasDe(page, 'En revision')).toContainText(titulo);

    await page.goto(`/proyectos/${proyectoPropio.id}/configuracion`);
    await page.getByRole('button', { name: 'Eliminar columna En revision' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Eliminar columna' });
    await expect(dialogo).toContainText('tiene 1 elemento');
    await dialogo.getByLabel('Mover sus elementos a').selectOption({ label: 'En progreso' });

    const eliminada = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().includes('/columns/'),
    );
    await dialogo.getByRole('button', { name: 'Eliminar', exact: true }).click();
    expect((await eliminada).status()).toBe(204);
    await expect(dialogo).toBeHidden();

    await page.goto(`/proyectos/${proyectoPropio.id}/tablero`);
    await expect(encabezadosDelTablero(page)).toHaveText(
      ['Por hacer', 'En progreso', 'Hecho'].map(empiezaCon),
    );
    await expect(tarjetasDe(page, 'En revision')).toHaveCount(0);
    await expect(tarjetasDe(page, 'En progreso').getByRole('article')).toHaveCount(1);
    await expect(tarjetasDe(page, 'En progreso')).toContainText(titulo);
  });
});
