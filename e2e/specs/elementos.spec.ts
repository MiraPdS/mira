import { expect, test } from '../fixtures';

test.describe('MIR-64 · CRUD de elementos', () => {
  test('MIR-11/12/14/15/16 · crear, consultar, editar y eliminar un elemento', async ({
    page,
    proyectoPropio,
  }) => {
    const titulo = `Elemento E2E ${proyectoPropio.key}`;
    const tituloEditado = `${titulo} editado`;
    const descripcion = `Descripción del elemento de ${proyectoPropio.key}`;

    await test.step('Crear el elemento y encontrarlo en el backlog', async () => {
      await page.goto(proyectoPropio.url);
      await expect(
        page.getByText('Aun no hay elementos en este proyecto.', { exact: true }),
      ).toBeVisible();

      await page.getByRole('button', { name: '+ Crear elemento', exact: true }).click();
      await page.getByRole('textbox', { name: 'Titulo', exact: true }).fill(titulo);
      await page.getByRole('textbox', { name: 'Descripcion', exact: true }).fill(descripcion);
      await page.getByRole('button', { name: 'Crear elemento', exact: true }).click();

      await expect(
        page.getByRole('status').filter({
          hasText: `Elemento ${proyectoPropio.key}-1 creado correctamente.`,
        }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: titulo, exact: true })).toBeVisible();
    });

    await test.step('Abrir el detalle y guardar un nuevo título', async () => {
      await page.getByRole('link', { name: titulo, exact: true }).click();
      await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
      await expect(page.getByText(`${proyectoPropio.key}-1`, { exact: true })).toBeVisible();
      await expect(page.getByText(descripcion, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Titulo', exact: true })).toHaveValue(titulo);
      await page.getByRole('textbox', { name: 'Titulo', exact: true }).fill(tituloEditado);
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();

      await expect(page.getByRole('heading', { name: tituloEditado, exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: tituloEditado, exact: true })).toBeVisible();
      await expect(page.getByText(descripcion, { exact: true })).toBeVisible();
    });

    await test.step('Confirmar la eliminación y comprobar el backlog vacío', async () => {
      await page.getByRole('button', { name: 'Eliminar elemento', exact: true }).click();
      const confirmacion = page.getByRole('dialog', { name: 'Eliminar elemento', exact: true });
      await expect(confirmacion).toBeVisible();
      await expect(confirmacion).toContainText(`${proyectoPropio.key}-1: ${tituloEditado}`);
      await confirmacion.getByRole('button', { name: 'Eliminar', exact: true }).click();

      await expect(page).toHaveURL(proyectoPropio.url);
      await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
      await expect(
        page.getByText('Aun no hay elementos en este proyecto.', { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: tituloEditado, exact: true })).toHaveCount(0);

      await page.reload();
      await expect(
        page.getByText('Aun no hay elementos en este proyecto.', { exact: true }),
      ).toBeVisible();
    });
  });

  test('MIR-11 · crear sin título muestra la validación y no crea elementos', async ({
    page,
    proyectoPropio,
  }) => {
    await page.goto(proyectoPropio.url);
    await expect(
      page.getByText('Aun no hay elementos en este proyecto.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '+ Crear elemento', exact: true }).click();

    const titulo = page.getByRole('textbox', { name: 'Titulo', exact: true });
    await expect(titulo).toHaveValue('');
    await page.getByRole('button', { name: 'Crear elemento', exact: true }).click();

    // El mensaje se toma de la UI y se comprueba su asociación accesible al campo.
    const errorTitulo = page.getByRole('alert').filter({ hasText: /titulo/i });
    await expect(errorTitulo).toBeVisible();
    await expect(titulo).toHaveAttribute('aria-invalid', 'true');
    await expect(titulo).toHaveAccessibleDescription(await errorTitulo.innerText());

    await page.getByRole('button', { name: 'Cerrar formulario', exact: true }).click();
    await page.reload();
    await expect(
      page.getByText('Aun no hay elementos en este proyecto.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
