import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '@/lib/query-client';

/**
 * Render con los proveedores REALES de la aplicacion.
 *
 * No se mockean el router ni TanStack Query: el objetivo es ejercitar el
 * mismo arbol que corre en produccion y dejar que MSW sea lo unico falso.
 *
 * El QueryClient se crea nuevo en cada render para que la cache de un test no
 * contamine al siguiente, y con retry desactivado para que un caso de error
 * no tarde varios segundos en reintentos.
 *
 * Se parte de createQueryClient() (el de produccion) para conservar su
 * comportamiento global, como el manejo de 401; solo se pisan las opciones
 * que hacen lentos o acoplados a los tests.
 */
function crearQueryClientDePrueba(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  });
  return queryClient;
}

export interface RenderConPropsOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Ruta inicial del MemoryRouter. */
  route?: string;
  queryClient?: QueryClient;
}

export function renderConProviders(
  ui: ReactElement,
  { route = '/', queryClient = crearQueryClientDePrueba(), ...options }: RenderConPropsOptions = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup>; queryClient: QueryClient } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    user: userEvent.setup(),
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from '@testing-library/react';
