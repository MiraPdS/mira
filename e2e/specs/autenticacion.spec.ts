import { randomUUID } from 'node:crypto';
import { expect, sinSesion, test, usuarios } from '../fixtures';

/**
 * MIR-63 · E2E de autenticación y sesión (MIR-1 a MIR-4).
 *
 * Todo empieza sin sesión: lo que se prueba es justamente entrar y salir.
 * Ningún test cambia datos del seed: el registro usa un correo nuevo y el
 * cierre de sesión solo borra la cookie de su propio navegador.
 */
const ada = usuarios.ada;

test.describe('MIR-63 · Autenticación y sesión', () => {
  test.use({ storageState: sinSesion });

  test('registrarse con un correo nuevo entra a Mis proyectos con la sesión iniciada', async ({
    page,
  }) => {
    const correo = `e2e-${randomUUID().slice(0, 8)}@mira.dev`;

    await page.goto('/registro');
    await page.getByLabel('Nombre', { exact: true }).fill('Usuaria E2E');
    await page.getByLabel('Correo electronico', { exact: true }).fill(correo);
    await page.getByLabel('Contrasena', { exact: true }).fill('clave1234');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page).toHaveURL(/\/proyectos$/);
    await expect(page.getByRole('heading', { name: 'Mis proyectos', level: 1 })).toBeVisible();
    await expect(page.getByRole('banner').getByText('Usuaria E2E')).toBeVisible();
    await expect(page.getByText('Aun no participas en ningun proyecto.')).toBeVisible();
  });

  test('registrarse con un correo que ya existe muestra el error y no entra', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre', { exact: true }).fill('Otra Ada');
    await page.getByLabel('Correo electronico', { exact: true }).fill(ada.email);
    await page.getByLabel('Contrasena', { exact: true }).fill('clave1234');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('Ya existe una cuenta con ese correo')).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test('una contraseña incorrecta muestra el mensaje genérico y no entra', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electronico', { exact: true }).fill(ada.email);
    await page.getByLabel('Contrasena', { exact: true }).fill('incorrecta123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // Mismo mensaje que para un correo inexistente: no revela si la cuenta existe.
    await expect(page.getByRole('alert')).toHaveText('Correo o contrasena incorrectos');
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/proyectos');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('iniciar sesión entra a Mis proyectos y recargar mantiene la sesión', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electronico', { exact: true }).fill(ada.email);
    await page.getByLabel('Contrasena', { exact: true }).fill(ada.password);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/proyectos$/);
    await expect(page.getByRole('banner').getByText(ada.nombre)).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/proyectos$/);
    await expect(page.getByRole('banner').getByText(ada.nombre)).toBeVisible();
    await expect(page.getByText('Plataforma Mira')).toBeVisible();
  });

  test.describe('con sesión iniciada', () => {
    test.use({ storageState: ada.storage });

    test('cerrar sesión lleva a /login y /proyectos vuelve a pedir login', async ({ page }) => {
      await page.goto('/proyectos');
      await expect(page.getByRole('banner').getByText(ada.nombre)).toBeVisible();

      await page.getByRole('button', { name: 'Cerrar sesion' }).click();

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Iniciar sesion', level: 1 })).toBeVisible();

      await page.goto('/proyectos');
      await expect(page).toHaveURL(/\/login$/);
    });
  });
});
