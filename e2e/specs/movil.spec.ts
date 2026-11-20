import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';

/**
 * MIR-70 · E2E de navegación en móvil (MIR-24, MIR-49).
 *
 * Solo corre en el proyecto `mobile` (375 × 812, touch): etiquetas `@movil` y
 * `@solo-movil` (ver e2e/README.md).  Navega como ada por el proyecto MIR del
 * seed y solo lee: no modifica datos.
 */
const SOLO_MOVIL = { tag: ['@movil', '@solo-movil'] };

/** Junta las excepciones de la página: "sin errores" incluye las de JavaScript. */
function registrarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  return errores;
}

/** La página no se desplaza a lo ancho: nada se sale de los 375 px. */
async function sinScrollHorizontal(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBe(0);
}

/** Carga completa y sin mensajes de error ni de "Cargando...". */
async function vistaCargada(page: Page, titulo: Locator): Promise<void> {
  await expect(titulo).toBeVisible();
  await expect(page.getByText(/^Cargando/)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

test.describe('MIR-70 · Navegación en móvil', () => {
  test(
    'se recorren proyectos, backlog, tablero y sprints sin errores ni scroll horizontal',
    SOLO_MOVIL,
    async ({ page }) => {
      const errores = registrarErrores(page);

      await page.goto('/proyectos');
      await vistaCargada(page, page.getByRole('heading', { name: 'Mis proyectos', level: 1 }));
      await sinScrollHorizontal(page);

      await page.getByRole('link', { name: 'Plataforma Mira', exact: true }).click();
      await vistaCargada(
        page,
        page.getByRole('heading', { name: 'Resumen del proyecto', level: 1 }),
      );
      await sinScrollHorizontal(page);

      await page.getByRole('link', { name: /ver backlog/i }).click();
      await vistaCargada(page, page.getByRole('heading', { name: 'Backlog', level: 1 }));
      await sinScrollHorizontal(page);

      await page.getByRole('link', { name: /volver al proyecto/i }).click();
      await page.getByRole('link', { name: /ver tablero/i }).click();
      await vistaCargada(page, page.getByRole('region', { name: 'Columnas del tablero' }));
      await sinScrollHorizontal(page);

      await page.goBack();
      await page.getByRole('link', { name: /ver sprints/i }).click();
      await vistaCargada(page, page.getByRole('heading', { name: 'Sprints', level: 1 }));
      await sinScrollHorizontal(page);

      expect(errores).toEqual([]);
    },
  );

  test(
    'el tablero se desplaza a lo ancho dentro de su región, con columnas legibles',
    SOLO_MOVIL,
    async ({ page }) => {
      await page.goto('/proyectos');
      await page.getByRole('link', { name: 'Plataforma Mira', exact: true }).click();
      await page.getByRole('link', { name: /ver tablero/i }).click();

      const tablero = page.getByRole('region', { name: 'Columnas del tablero' });
      await vistaCargada(page, tablero);

      // El que se desplaza es el tablero, no la página.
      await sinScrollHorizontal(page);
      const { ancho, visible } = await tablero.evaluate((el) => ({
        ancho: el.scrollWidth,
        visible: el.clientWidth,
      }));
      expect(ancho).toBeGreaterThan(visible);

      const primera = tablero.getByRole('region', { name: 'Por hacer' });
      const segunda = tablero.getByRole('region', { name: 'En progreso' });
      const ultima = tablero.getByRole('region', { name: 'Hecho' });

      // Al entrar se ve la primera columna entera y asoma la siguiente (MIR-24).
      await expect(primera).toBeInViewport({ ratio: 0.95 });
      await expect(segunda).toBeInViewport();
      await expect(ultima).not.toBeInViewport();

      // Columnas legibles: ni aplastadas ni más anchas que la pantalla.
      const caja = await primera.boundingBox();
      expect(caja?.width ?? 0).toBeGreaterThanOrEqual(250);
      expect(caja?.width ?? 0).toBeLessThanOrEqual(375);

      // Desplazar el tablero muestra la última columna con su título.
      await ultima.scrollIntoViewIfNeeded();
      await expect(ultima.getByRole('heading', { name: 'Hecho' })).toBeInViewport();
      await sinScrollHorizontal(page);
    },
  );
});
