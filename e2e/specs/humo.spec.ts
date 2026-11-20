import { expect, sinSesion, test, usuarios } from '../fixtures';

/**
 * Humo de la demo publicada (MIR-72).  El job `Humo E2E` de ci.yml corre
 * estos tests contra https://mira-pds.vercel.app despues de cada despliegue,
 * y el job `E2E` los corre como cualquier otra spec contra el seed local.
 *
 * Reglas de un test @humo (D2 de docs/plans/MIR-72-humo-e2e.md):
 *   - Solo lee: nada de proyectoPropio, registro ni formularios que guardan.
 *     La demo no se resetea y lo que se escriba queda para siempre.
 *   - Solo afirma lo que el seed asegura en cada deploy (usuarios y el
 *     proyecto MIR).  Las credenciales son publicas: un visitante puede
 *     borrar items, renombrar el proyecto o cambiar columnas, y eso no es
 *     un defecto.
 */

const { ada } = usuarios;

test.describe('MIR-72 · Humo de la demo', { tag: '@humo' }, () => {
  test.describe('sin sesión', () => {
    test.use({ storageState: sinSesion });

    test('iniciar sesión con la cuenta de demo entra a Mis proyectos', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Correo electronico', { exact: true }).fill(ada.email);
      await page.getByLabel('Contrasena', { exact: true }).fill(ada.password);
      await page.getByRole('button', { name: 'Ingresar' }).click();

      await expect(page).toHaveURL(/\/proyectos$/);
      await expect(page.getByRole('banner').getByText(ada.nombre)).toBeVisible();
    });
  });

  test('abrir el tablero de MIR muestra sus columnas', async ({ page }) => {
    await page.goto('/proyectos');

    // Por la clave y no por el nombre, que un visitante puede editar.  El id
    // tampoco sirve: en la demo no es el del seed local.
    const tarjetaMir = page
      .getByRole('listitem')
      .filter({ has: page.getByText('MIR', { exact: true }) });
    await tarjetaMir.getByRole('link', { name: /^Ver tablero de / }).click();

    await expect(page).toHaveURL(/\/proyectos\/[^/]+\/tablero$/);
    await expect(page.getByRole('region', { name: 'Columnas del tablero' })).toBeVisible();
  });
});
