import { beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import type * as ReactRouter from 'react-router-dom';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { createQueryClient } from '@/lib/query-client';
import { authKeys } from './useAuth';
import { LogoutButton } from './LogoutButton';

// Mismo patron que LoginPage.test.tsx: se intercepta useNavigate para afirmar
// la redireccion sin montar el arbol de rutas.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const BASE_URL = 'http://localhost:3000/api';

/**
 * Las pruebas afirman sobre la cache, pero aqui nadie observa `me`: con el
 * gcTime 0 del cliente de prueba se borraria sola y los asserts pasarian por
 * la razon equivocada. Por eso se conserva la cache durante el test.
 */
function renderConSesion() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false },
  });
  queryClient.setQueryData(authKeys.me, USUARIO_DE_PRUEBA);
  return renderConProviders(<LogoutButton />, { queryClient });
}

describe('LogoutButton', () => {
  beforeEach(() => navigateMock.mockClear());

  it('al responder 204 descarta la sesion y redirige a /login', async () => {
    const { user, queryClient } = renderConSesion();

    await user.click(screen.getByRole('button', { name: /cerrar sesion/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }));
    expect(queryClient.getQueryData(authKeys.me)).toBeUndefined();
  });

  it('no deja datos cacheados del usuario anterior', async () => {
    const { user, queryClient } = renderConSesion();
    queryClient.setQueryData(['projects'], [{ id: 'p1', name: 'Proyecto de Ada' }]);

    await user.click(screen.getByRole('button', { name: /cerrar sesion/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  });

  it('deshabilita el boton mientras la peticion esta en curso', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/logout`, async () => {
        await delay(100);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderConSesion();

    await user.click(screen.getByRole('button', { name: /cerrar sesion/i }));

    expect(screen.getByRole('button', { name: /cerrando/i })).toBeDisabled();
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });

  it('si el servidor falla, mantiene la sesion y muestra el error', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/logout`, () => apiError(500, 'INTERNAL', 'Error interno')),
    );
    const { user, queryClient } = renderConSesion();

    await user.click(screen.getByRole('button', { name: /cerrar sesion/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cerrar sesion/i);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(authKeys.me)).toEqual(USUARIO_DE_PRUEBA);
    expect(screen.getByRole('button', { name: /cerrar sesion/i })).toBeEnabled();
  });
});
