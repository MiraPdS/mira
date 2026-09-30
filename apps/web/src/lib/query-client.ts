import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api-client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
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
}
