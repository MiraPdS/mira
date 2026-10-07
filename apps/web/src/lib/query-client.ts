import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { authKeys } from '@/features/auth/useAuth';
import { ApiRequestError } from './api-client';

export function createQueryClient(): QueryClient {
  /**
   * Sesion perdida a mitad de uso (token expirado, cookie borrada en otra
   * pestana): cualquier 401 deja al usuario sin sesion y descarta la cache,
   * y la guardia del layout lo redirige a /login.
   *
   * Excepcion: INVALID_CREDENTIALS tambien es 401, pero significa "contrasena
   * mala" en el formulario de login, no "se acabo la sesion".
   * /auth/me no llega aqui: su queryFn ya convierte el 401 en null.
   */
  const alPerderSesion = (error: Error) => {
    if (!(error instanceof ApiRequestError)) return;
    if (error.status !== 401 || error.code === 'INVALID_CREDENTIALS') return;

    queryClient.setQueryData(authKeys.me, null);
    queryClient.clear();
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: alPerderSesion }),
    mutationCache: new MutationCache({ onError: alPerderSesion }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (intentos, error) => {
          // Reintentar un 401 o un 404 no los va a arreglar y solo retrasa
          // el mensaje de error al usuario.
          if (error instanceof ApiRequestError && error.status < 500) return false;
          return intentos < 2;
        },
      },
      mutations: { retry: false },
    },
  });

  return queryClient;
}
