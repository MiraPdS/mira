import type { Page } from '@playwright/test';
import { expect, test, usuarios, type ProyectoPropio } from '../fixtures';

/**
 * MIR-67: E2E del tablero y del historial.
 *
 * Las tarjetas se mueven SOLO con el menu "Mover a…" (MIR-19): es el camino
 * determinista. El arrastre con dnd-kit (MIR-20) queda fuera a proposito; el
 * motivo esta en la Wiki (Proyecto-Estrategia-de-pruebas).
 */

interface Columna {
  id: string;
  name: string;
  position: number;
}

interface ElementoCreado {
  id: string;
  reference: string;
  title: string;
}

/**
 * Crea por API un elemento en la primera columna del proyecto. Un elemento
 * creado sin `columnId` queda en el backlog y no se ve en el tablero; como
 * proyectoPropio no tiene sprint activo, el tablero muestra todos los
 * elementos con columna.
 */
async function crearElementoEnTablero(page: Page, proyecto: ProyectoPropio, title: string) {
  const respuestaColumnas = await page.request.get(`/api/projects/${proyecto.id}/columns`);
  expect(respuestaColumnas.status()).toBe(200);
  const { columns } = (await respuestaColumnas.json()) as { columns: Columna[] };
  const [primera] = [...columns].sort((a, b) => a.position - b.position);
  if (!primera) throw new Error('El proyecto nuevo no tiene columnas');

  const respuesta = await page.request.post(`/api/projects/${proyecto.id}/work-items`, {
    data: { title, columnId: primera.id },
  });
  expect(respuesta.status()).toBe(201);
  const { item } = (await respuesta.json()) as { item: ElementoCreado };
  return { item, columnaInicial: primera.name };
}

/** Lista de tarjetas de una columna, por su nombre accesible. */
const tarjetasDe = (page: Page, columna: string) =>
  page.getByRole('list', { name: `Tarjetas de ${columna}` });

/**
 * Mueve la tarjeta con "Mover a…" y espera la respuesta del PATCH: la
 * actualizacion es optimista, asi que la tarjeta cambia de columna antes de
 * que la API confirme.
 */
async function moverCon(page: Page, item: ElementoCreado, destino: string) {
  const tarjeta = page.getByRole('article', { name: item.title });
  await tarjeta.getByRole('button', { name: 'Mover a…' }).click();

  const confirmado = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().endsWith(`/work-items/${item.id}/status`),
  );
  await page
    .getByRole('menu', { name: `Mover ${item.reference} a` })
    .getByRole('menuitem', { name: destino })
    .click();
  expect((await confirmado).status()).toBe(200);
}

test.describe('MIR-19 · Mover tarjeta', () => {
  test(
    'mover con "Mover a…" cambia la tarjeta de columna y persiste al recargar',
    { tag: '@movil' },
    async ({ page, proyectoPropio }) => {
      const { item, columnaInicial } = await crearElementoEnTablero(
        page,
        proyectoPropio,
        'Tarjeta que cambia de columna',
      );
      await page.goto(`/proyectos/${proyectoPropio.id}/tablero`);

      const tarjeta = page.getByRole('article', { name: item.title });
      await expect(tarjetasDe(page, columnaInicial).getByRole('article')).toHaveCount(1);
      await expect(tarjetasDe(page, columnaInicial)).toContainText(item.title);

      await moverCon(page, item, 'En progreso');

      await expect(tarjetasDe(page, 'En progreso').getByRole('article')).toHaveCount(1);
      await expect(tarjetasDe(page, 'En progreso')).toContainText(item.title);
      await expect(tarjetasDe(page, columnaInicial).getByRole('article')).toHaveCount(0);

      await page.reload();

      // Despues de recargar: los data-testid estables de MIR-67.
      const columnaDestino = page
        .getByTestId('columna-tablero')
        .filter({ has: tarjetasDe(page, 'En progreso') });
      await expect(columnaDestino.getByTestId('tarjeta-elemento')).toHaveAttribute(
        'data-elemento-id',
        item.id,
      );
      await expect(tarjeta).toBeVisible();
      await expect(tarjetasDe(page, columnaInicial).getByRole('article')).toHaveCount(0);
    },
  );
});

test.describe('MIR-22 · Historial', () => {
  test('el movimiento hecho en el tablero aparece en el historial del elemento', async ({
    page,
    proyectoPropio,
  }) => {
    const { item, columnaInicial } = await crearElementoEnTablero(
      page,
      proyectoPropio,
      'Tarjeta con historial',
    );
    await page.goto(`/proyectos/${proyectoPropio.id}/tablero`);

    await moverCon(page, item, 'Hecho');
    await expect(tarjetasDe(page, 'Hecho')).toContainText(item.title);

    await page.getByRole('article', { name: item.title }).getByRole('link').click();
    await expect(page).toHaveURL(`/proyectos/${proyectoPropio.id}/elementos/${item.id}`);

    const historial = page.getByRole('region', { name: 'Historial' });
    await expect(historial.getByRole('listitem')).toHaveCount(2);
    await expect(historial.getByRole('listitem').first()).toContainText(
      `${usuarios.ada.nombre} movió de ${columnaInicial} a Hecho`,
    );
    await expect(historial.getByRole('listitem').last()).toContainText(
      `${usuarios.ada.nombre} creó el ítem`,
    );
  });
});
