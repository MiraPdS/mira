import { expect, test } from '../fixtures';

test.describe('MIR-68 · Ciclo de un sprint', () => {
  test('MIR-43/44/45/46/47 · planificar, iniciar y cerrar un sprint con trabajo pendiente', async ({
    page,
    proyectoPropio,
  }) => {
    const tituloElemento = `Pendiente E2E ${proyectoPropio.key}`;
    const nombreSprint = `Sprint E2E ${proyectoPropio.key}`;
    const estimacion = 5;
    const urlSprints = `/proyectos/${proyectoPropio.id}/sprints`;
    const tarjetaSprint = page.getByRole('article', { name: nombreSprint, exact: true });

    await test.step('Preparar por API un elemento sin terminar de 5 puntos', async () => {
      const respuesta = await page.request.post(`/api/projects/${proyectoPropio.id}/work-items`, {
        data: {
          title: tituloElemento,
          type: 'TASK',
          priority: 'MEDIUM',
          estimate: estimacion,
          columnId: null,
        },
      });
      expect(respuesta.status(), await respuesta.text()).toBe(201);
      expect(await respuesta.json()).toMatchObject({
        item: {
          projectId: proyectoPropio.id,
          title: tituloElemento,
          estimate: estimacion,
          columnId: null,
          sprintId: null,
        },
      });
    });

    await test.step('Crear el sprint y encontrarlo en Planificados', async () => {
      await page.goto(urlSprints);
      await page.getByRole('button', { name: '+ Crear sprint', exact: true }).click();
      const formulario = page.getByRole('form', { name: 'Crear sprint', exact: true });
      await formulario.getByRole('textbox', { name: 'Nombre', exact: true }).fill(nombreSprint);
      await formulario.getByLabel('Fecha de inicio', { exact: true }).fill('2026-11-02');
      await formulario.getByLabel('Fecha de termino', { exact: true }).fill('2026-11-15');
      await formulario.getByRole('button', { name: 'Crear sprint', exact: true }).click();

      await expect(
        page.getByRole('region', { name: 'Planificados', exact: true }).getByRole('article', {
          name: nombreSprint,
          exact: true,
        }),
      ).toBeVisible();
    });

    await test.step('Asignar el elemento al sprint desde su detalle', async () => {
      await page.goto(proyectoPropio.url);
      await page.getByRole('link', { name: tituloElemento, exact: true }).click();
      await expect(page.getByRole('heading', { name: tituloElemento, exact: true })).toBeVisible();
      const selector = page.getByRole('combobox', { name: 'Sprint', exact: true });
      await expect(selector).toBeEnabled();
      await selector.selectOption({ label: nombreSprint });
      await expect(selector).toBeEnabled();
      await expect(selector).toHaveAttribute('aria-busy', 'false');

      await page.reload();
      await expect(
        selector.getByRole('option', { name: nombreSprint, exact: true, selected: true }),
      ).toBeAttached();
    });

    await test.step('Iniciar el sprint mediante el diálogo de confirmación', async () => {
      await page.goto(urlSprints);
      await expect(
        tarjetaSprint.getByText(`1 elemento · ${estimacion} puntos`, { exact: true }),
      ).toBeVisible();
      await tarjetaSprint.getByRole('button', { name: 'Iniciar sprint', exact: true }).click();
      const dialogo = page.getByRole('dialog', {
        name: `Iniciar sprint: ${nombreSprint}`,
        exact: true,
      });
      await expect(dialogo).toBeVisible();
      await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await expect(dialogo).toBeHidden();
      await expect(
        page.getByRole('region', { name: 'Sprint activo', exact: true }).getByRole('article', {
          name: nombreSprint,
          exact: true,
        }),
      ).toBeVisible();
    });

    await test.step('Comprobar que el tablero muestra el sprint activo por defecto', async () => {
      await page.goto(`/proyectos/${proyectoPropio.id}/tablero`);
      const vista = page.getByRole('combobox', { name: 'Vista del tablero', exact: true });
      await expect(vista).toBeVisible();
      await expect(
        vista.getByRole('option', {
          name: `Sprint activo: ${nombreSprint}`,
          exact: true,
          selected: true,
        }),
      ).toBeAttached();
    });

    await test.step('Cerrar el sprint hacia Backlog y comprobar sus métricas', async () => {
      await page.goto(urlSprints);
      await tarjetaSprint.getByRole('button', { name: 'Cerrar sprint', exact: true }).click();
      const dialogo = page.getByRole('dialog', {
        name: `Cerrar sprint: ${nombreSprint}`,
        exact: true,
      });
      await expect(dialogo).toBeVisible();
      await dialogo
        .getByRole('combobox', { name: 'Destino de los elementos no terminados', exact: true })
        .selectOption({ label: 'Backlog' });
      await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await expect(dialogo).toBeHidden();

      const cerrado = page
        .getByRole('region', { name: 'Cerrados', exact: true })
        .getByRole('article', {
          name: nombreSprint,
          exact: true,
        });
      await expect(cerrado).toBeVisible();
      await page.reload();
      await expect(cerrado.getByRole('term')).toHaveText([
        'Puntos comprometidos',
        'Puntos completados',
      ]);
      // MIR-46 suma todas las estimaciones; solo la categoría DONE aporta completados.
      await expect(cerrado.getByRole('definition')).toHaveText([String(estimacion), '0']);
    });

    await test.step('Encontrar el elemento en el backlog y comprobar que quedó sin sprint', async () => {
      await page.goto(proyectoPropio.url);
      await page
        .getByRole('combobox', { name: 'Sprint', exact: true })
        .selectOption({ label: 'Sin sprint' });
      await page.getByRole('link', { name: tituloElemento, exact: true }).click();
      await expect(page.getByRole('heading', { name: tituloElemento, exact: true })).toBeVisible();
      const selector = page.getByRole('combobox', { name: 'Sprint', exact: true });
      await expect(selector).toBeEnabled();
      await expect(selector).toHaveValue('');
      await expect(
        selector.getByRole('option', { name: 'Sin sprint', exact: true, selected: true }),
      ).toBeAttached();
    });
  });
});
