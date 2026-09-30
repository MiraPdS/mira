import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PublicUser, RegisterInput } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { authApi } from './auth.api';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/**
 * Sesion actual.
 *
 * El token vive en una cookie httpOnly que JavaScript no puede leer, asi que
 * la unica forma de saber si hay sesion es preguntarle al servidor. Un 401 NO
 * es un error a mostrar: significa "no hay sesion" y se traduce a null.
 */
export function useCurrentUser() {
  return useQuery<PublicUser | null>({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        const { user } = await authApi.me();
        return user;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: ({ user }) => {
      // Se escribe la cache directamente en vez de invalidar: el servidor ya
      // devolvio el usuario, pedirlo otra vez seria un viaje de red inutil.
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: ({ user }) => queryClient.setQueryData(authKeys.me, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me, null);
      // Al cerrar sesion se descarta TODA la cache: los proyectos del usuario
      // anterior no deben quedar visibles para el siguiente que entre.
      void queryClient.clear();
    },
  });
}
