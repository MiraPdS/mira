import { expect, test as setup } from '@playwright/test';
import { usuarios } from './fixtures/usuarios';

/**
 * Proyecto `setup` (D4): inicia sesion por API con cada usuario del seed y
 * guarda su cookie en e2e/.auth/<usuario>.json.  Va por el mismo BASE_URL que
 * las specs (proxy /api de vite preview, D2), asi la cookie queda en el mismo
 * origen que usa el navegador.
 *
 * El login por la UI se prueba en MIR-63, no aqui.
 */
for (const usuario of Object.values(usuarios)) {
  setup(`sesion de ${usuario.email}`, async ({ request }) => {
    const respuesta = await request.post('/api/auth/login', {
      data: { email: usuario.email, password: usuario.password },
    });
    expect(respuesta.status(), await respuesta.text()).toBe(200);

    await request.storageState({ path: usuario.storage });
  });
}
