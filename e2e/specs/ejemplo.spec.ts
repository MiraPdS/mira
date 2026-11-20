import { expect, sinSesion, test } from '../fixtures';

/**
 * Spec de ejemplo del andamiaje (MIR-61).  Sirve de plantilla: describe por
 * historia, nombres en español, selectores por rol/etiqueta y solo `expect`
 * con reintento automatico (convenciones en e2e/README.md).
 */
test.describe('MIR-61 · Andamiaje', () => {
  test.describe('sin sesion', () => {
    test.use({ storageState: sinSesion });

    test('la pantalla de login muestra el formulario', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByLabel(/correo/i)).toBeVisible();
      await expect(page.getByLabel(/contrase[nñ]a/i)).toBeVisible();
    });
  });

  test('ada entra directo a sus proyectos con la sesion guardada', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/proyectos$/);
    await expect(page.getByText('Plataforma Mira')).toBeVisible();
  });

  test('proyectoPropio crea un proyecto nuevo y abre su backlog', async ({
    page,
    proyectoPropio,
  }) => {
    await page.goto(proyectoPropio.url);

    await expect(page).toHaveURL(proyectoPropio.url);
    await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /volver al proyecto/i })).toHaveAttribute(
      'href',
      `/proyectos/${proyectoPropio.id}`,
    );
  });
});
