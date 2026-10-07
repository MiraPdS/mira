import { describe, expect, it } from 'vitest';
import { MutationObserver } from '@tanstack/react-query';
import { authKeys } from '@/features/auth/useAuth';
import { USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { ApiRequestError } from './api-client';
import { createQueryClient } from './query-client';

/**
 * Manejo global de la sesion perdida.
 *
 * Se prueba sobre el QueryClient de produccion: un 401 en cualquier query o
 * mutacion cierra la sesion en el cliente, salvo INVALID_CREDENTIALS, que es
 * "contrasena mala" y no "sesion expirada".
 */

function clienteConSesion() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  queryClient.setQueryData(authKeys.me, USUARIO_DE_PRUEBA);
  queryClient.setQueryData(['projects'], [{ id: 'p1' }]);
  return queryClient;
}

describe('createQueryClient', () => {
  it('un 401 en una query cierra la sesion y descarta la cache', async () => {
    const queryClient = clienteConSesion();

    await queryClient
      .fetchQuery({
        queryKey: ['work-items'],
        queryFn: () => {
          throw new ApiRequestError(401, 'UNAUTHORIZED', 'Debes iniciar sesion');
        },
      })
      .catch(() => undefined);

    expect(queryClient.getQueryData(authKeys.me)).toBeUndefined();
    expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  });

  it('un 401 en una mutacion tambien cierra la sesion', async () => {
    const queryClient = clienteConSesion();
    const observer = new MutationObserver(queryClient, {
      mutationFn: () =>
        Promise.reject(new ApiRequestError(401, 'UNAUTHORIZED', 'Debes iniciar sesion')),
    });

    await observer.mutate().catch(() => undefined);

    expect(queryClient.getQueryData(authKeys.me)).toBeUndefined();
    expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  });

  it('INVALID_CREDENTIALS no toca la sesion ni la cache', async () => {
    const queryClient = clienteConSesion();
    const observer = new MutationObserver(queryClient, {
      mutationFn: () =>
        Promise.reject(
          new ApiRequestError(401, 'INVALID_CREDENTIALS', 'Correo o contrasena incorrectos'),
        ),
    });

    await observer.mutate().catch(() => undefined);

    expect(queryClient.getQueryData(authKeys.me)).toEqual(USUARIO_DE_PRUEBA);
    expect(queryClient.getQueryData(['projects'])).toEqual([{ id: 'p1' }]);
  });

  it('otros errores (500) no tocan la sesion', async () => {
    const queryClient = clienteConSesion();

    await queryClient
      .fetchQuery({
        queryKey: ['work-items'],
        queryFn: () => {
          throw new ApiRequestError(500, 'INTERNAL', 'Error interno');
        },
      })
      .catch(() => undefined);

    expect(queryClient.getQueryData(authKeys.me)).toEqual(USUARIO_DE_PRUEBA);
  });
});
