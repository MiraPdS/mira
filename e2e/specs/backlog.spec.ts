import type { Locator, Page } from '@playwright/test';
import { expect, test, usuarios, type ProyectoPropio } from '../fixtures';

/**
 * MIR-66: E2E de busqueda, filtros y comentarios.
 *
 * Los filtros del backlog viven en el estado del componente (no en la URL),
 * por eso no se prueba que sobrevivan a una recarga.
 */

interface Columna {
  id: string;
  name: string;
}

interface ElementoCreado {
  id: string;
  title: string;
}

interface Miembro {
  user: { id: string; email: string };
}

const TITULOS = {
  loginMovil: 'Corregir login movil',
  exportarPdf: 'Corregir exportacion a PDF',
  ajustes: 'Disenar pantalla de ajustes',
  reportes: 'Documentar API de reportes',
  tableroVacio: 'Corregir tablero vacio',
};

/**
 * Prepara cinco elementos que difieren en titulo, estado, prioridad y
 * responsable, para que cada filtro deje un subconjunto distinto:
 *
 *   titulo                       estado       prioridad  responsable
 *   Corregir login movil         Por hacer    Alta       alan
 *   Corregir exportacion a PDF   En progreso  Baja       ada
 *   Disenar pantalla de ajustes  Por hacer    Alta       ada
 *   Documentar API de reportes   Backlog      Media      (nadie)
 *   Corregir tablero vacio       Hecho        Alta       alan
 */
async function prepararBacklog(page: Page, proyecto: ProyectoPropio) {
  const respuestaColumnas = await page.request.get(`/api/projects/${proyecto.id}/columns`);
  expect(respuestaColumnas.status()).toBe(200);
  const { columns } = (await respuestaColumnas.json()) as { columns: Columna[] };
  const columna = (nombre: string) => {
    const encontrada = columns.find((c) => c.name === nombre);
    if (!encontrada) throw new Error(`El proyecto nuevo no tiene la columna ${nombre}`);
    return encontrada.id;
  };

  const alta = await page.request.post(`/api/projects/${proyecto.id}/members`, {
    data: { email: usuarios.alan.email, role: 'MEMBER' },
  });
  expect(alta.status()).toBe(201);

  const respuestaMiembros = await page.request.get(`/api/projects/${proyecto.id}/members`);
  expect(respuestaMiembros.status()).toBe(200);
  const { members } = (await respuestaMiembros.json()) as { members: Miembro[] };
  const idDe = (email: string) => {
    const miembro = members.find((m) => m.user.email === email);
    if (!miembro) throw new Error(`${email} no es miembro del proyecto`);
    return miembro.user.id;
  };
  const ada = idDe(usuarios.ada.email);
  const alan = idDe(usuarios.alan.email);

  const datos: { title: string; columnId?: string; priority: string; assigneeId?: string }[] = [
    {
      title: TITULOS.loginMovil,
      columnId: columna('Por hacer'),
      priority: 'HIGH',
      assigneeId: alan,
    },
    {
      title: TITULOS.exportarPdf,
      columnId: columna('En progreso'),
      priority: 'LOW',
      assigneeId: ada,
    },
    { title: TITULOS.ajustes, columnId: columna('Por hacer'), priority: 'HIGH', assigneeId: ada },
    { title: TITULOS.reportes, priority: 'MEDIUM' },
    { title: TITULOS.tableroVacio, columnId: columna('Hecho'), priority: 'HIGH', assigneeId: alan },
  ];
  for (const { assigneeId, ...data } of datos) {
    const respuesta = await page.request.post(`/api/projects/${proyecto.id}/work-items`, { data });
    expect(respuesta.status()).toBe(201);
    // La creacion ignora assigneeId (MIR-11): el responsable se asigna aparte.
    if (assigneeId) {
      const { item } = (await respuesta.json()) as { item: ElementoCreado };
      const asignado = await page.request.patch(
        `/api/projects/${proyecto.id}/work-items/${item.id}/assignee`,
        { data: { assigneeId } },
      );
      expect(asignado.status()).toBe(200);
    }
  }
}

/** Titulos visibles en la tabla del backlog, en el orden mostrado. */
const titulosVisibles = (page: Page): Locator => page.getByRole('table').getByRole('link');

async function esperarTitulos(page: Page, esperados: string[]) {
  // El conjunto exacto, sin importar el orden, con reintento.
  await expect
    .poll(async () => (await titulosVisibles(page).allTextContents()).sort())
    .toEqual([...esperados].sort());
}

const TODOS = Object.values(TITULOS);

test.describe('MIR-13 · Buscar y filtrar backlog', () => {
  test.beforeEach(async ({ page, proyectoPropio }) => {
    await prepararBacklog(page, proyectoPropio);
    await page.goto(proyectoPropio.url);
    await esperarTitulos(page, TODOS);
  });

  test('buscar por texto deja solo los elementos que coinciden', async ({ page }) => {
    await page.getByLabel('Buscar').fill('Corregir');
    await esperarTitulos(page, [TITULOS.loginMovil, TITULOS.exportarPdf, TITULOS.tableroVacio]);

    await page.getByLabel('Buscar').fill('reportes');
    await esperarTitulos(page, [TITULOS.reportes]);

    await page.getByLabel('Buscar').fill('texto que no existe en ningun elemento');
    await expect(page.getByText('Sin resultados')).toBeVisible();
    await expect(titulosVisibles(page)).toHaveCount(0);
  });

  test('filtrar por estado, prioridad y responsable los combina', async ({ page }) => {
    await page.getByLabel('Estado').selectOption({ label: 'Por hacer' });
    await esperarTitulos(page, [TITULOS.loginMovil, TITULOS.ajustes]);

    await page.getByLabel('Prioridad').selectOption({ label: 'Alta' });
    await esperarTitulos(page, [TITULOS.loginMovil, TITULOS.ajustes]);

    await page
      .getByLabel('Responsable')
      .selectOption({ label: `${usuarios.alan.nombre} (${usuarios.alan.email})` });
    await esperarTitulos(page, [TITULOS.loginMovil]);

    // Quitar el estado deja prioridad Alta + responsable alan.
    await page.getByLabel('Estado').selectOption({ label: 'Todos' });
    await esperarTitulos(page, [TITULOS.loginMovil, TITULOS.tableroVacio]);

    // Prioridad sola, y estado Backlog solo.
    await page.getByLabel('Responsable').selectOption({ label: 'Todos' });
    await esperarTitulos(page, [TITULOS.loginMovil, TITULOS.ajustes, TITULOS.tableroVacio]);
    await page.getByLabel('Prioridad').selectOption({ label: 'Todas' });
    await page.getByLabel('Estado').selectOption({ label: 'Backlog' });
    await esperarTitulos(page, [TITULOS.reportes]);
  });

  test('buscar y filtrar a la vez, y "Limpiar filtros" restaura la lista completa', async ({
    page,
  }) => {
    const limpiar = page.getByRole('button', { name: 'Limpiar filtros' });
    await expect(limpiar).toBeDisabled();

    await page.getByLabel('Buscar').fill('Corregir');
    await page.getByLabel('Prioridad').selectOption({ label: 'Alta' });
    await esperarTitulos(page, [TITULOS.loginMovil, TITULOS.tableroVacio]);

    await limpiar.click();

    await esperarTitulos(page, TODOS);
    await expect(page.getByLabel('Buscar')).toHaveValue('');
    await expect(page.getByLabel('Prioridad')).toHaveValue('');
    await expect(limpiar).toBeDisabled();
  });
});

test.describe('MIR-21 · Comentar elemento', () => {
  test('el comentario aparece con autor y fecha sin recargar y persiste', async ({
    page,
    proyectoPropio,
  }) => {
    const respuesta = await page.request.post(`/api/projects/${proyectoPropio.id}/work-items`, {
      data: { title: 'Elemento para comentar' },
    });
    expect(respuesta.status()).toBe(201);
    const { item } = (await respuesta.json()) as { item: ElementoCreado };

    await page.goto(`/proyectos/${proyectoPropio.id}/elementos/${item.id}`);
    const comentarios = page.getByRole('region', { name: 'Comentarios' });
    await expect(comentarios.getByText('Todavía no hay comentarios.')).toBeVisible();

    const texto = 'Revisado con el equipo, listo para avanzar';
    await comentarios.getByLabel('Escribir comentario').fill(texto);

    const publicado = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith(`/work-items/${item.id}/comments`),
    );
    await comentarios.getByRole('button', { name: 'Publicar comentario' }).click();
    expect((await publicado).status()).toBe(201);

    const entrada = comentarios.getByRole('listitem');
    await expect(entrada).toHaveCount(1);
    await expect(entrada).toContainText(texto);
    await expect(entrada).toContainText(usuarios.ada.nombre);
    await expect(entrada.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    await expect(entrada.locator('time')).not.toBeEmpty();
    // El formulario se vacia tras publicar.
    await expect(comentarios.getByLabel('Escribir comentario')).toHaveValue('');

    await page.reload();
    const tras = page.getByRole('region', { name: 'Comentarios' }).getByRole('listitem');
    await expect(tras).toHaveCount(1);
    await expect(tras).toContainText(texto);
    await expect(tras).toContainText(usuarios.ada.nombre);
  });
});
