import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { WorkItemDto } from '@mira/shared';
import { server } from '@/test/msw/server';
import { useRemoveMember } from '@/features/projects/useProjects';
import {
  useCreateWorkItem,
  useDeleteWorkItem,
  useUpdateWorkItem,
} from '@/features/work-items/useWorkItems';
import { useBoard } from './useBoard';

/**
 * Las mutaciones que cambian lo que muestra una tarjeta deben refrescar el
 * tablero de su proyecto aunque su cache siga fresca (staleTime de 30 s, como
 * en la app), y no tocar el tablero de otros proyectos.
 *
 * Se ejecutan los hooks, TanStack Query y api-client reales; MSW es la API.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const OTHER_PROJECT_ID = 'project_789';
const WORK_ITEM_ID = 'item_456';

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: WORK_ITEM_ID,
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: 'Titulo',
    description: null,
    type: 'TASK',
    status: 'TODO',
    priority: 'MEDIUM',
    estimate: null,
    dueDate: null,
    assignee: null,
    createdBy: {
      id: 'user_1',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    sprintId: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Cuenta los GET del tablero por proyecto. */
function contarPeticionesDelTablero() {
  const peticiones: Record<string, number> = {};
  server.use(
    http.get(`${BASE_URL}/projects/:projectId/board`, ({ params }) => {
      const projectId = String(params.projectId);
      peticiones[projectId] = (peticiones[projectId] ?? 0) + 1;
      return HttpResponse.json({ items: [itemDePrueba({ projectId })] });
    }),
  );
  return peticiones;
}

function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Cache fresca: sin invalidacion, montar o re-renderizar no vuelve a pedir.
      queries: { retry: false, staleTime: 30_000, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/**
 * Monta los tableros de dos proyectos junto a la mutacion, la ejecuta y
 * devuelve cuantas veces se pidio cada tablero.
 */
async function ejecutarConTableros<TMutation extends { mutateAsync: () => Promise<unknown> }>(
  useMutacion: () => TMutation,
) {
  const peticiones = contarPeticionesDelTablero();
  const queryClient = crearQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => ({
      tablero: useBoard(PROJECT_ID),
      otroTablero: useBoard(OTHER_PROJECT_ID),
      mutacion: useMutacion(),
    }),
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.tablero.isSuccess).toBe(true);
    expect(result.current.otroTablero.isSuccess).toBe(true);
  });
  expect(peticiones).toEqual({ [PROJECT_ID]: 1, [OTHER_PROJECT_ID]: 1 });

  await act(async () => {
    await result.current.mutacion.mutateAsync();
  });

  await waitFor(() => expect(peticiones[PROJECT_ID]).toBe(2));
  expect(peticiones[OTHER_PROJECT_ID]).toBe(1);
}

describe('invalidacion del tablero - MIR-18', () => {
  it('crear un item refresca el tablero del proyecto', async () => {
    server.use(
      http.post(`${BASE_URL}/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ item: itemDePrueba() }, { status: 201 }),
      ),
    );

    await ejecutarConTableros(() => {
      const crear = useCreateWorkItem(PROJECT_ID);
      return {
        mutateAsync: () =>
          crear.mutateAsync({
            title: 'Nuevo item',
            type: 'TASK',
            status: 'TODO',
            priority: 'MEDIUM',
          }),
      };
    });
  });

  it('editar un item refresca el tablero del proyecto', async () => {
    server.use(
      http.patch(`${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`, () =>
        HttpResponse.json({ item: itemDePrueba({ title: 'Editado' }) }),
      ),
    );

    await ejecutarConTableros(() => {
      const editar = useUpdateWorkItem(PROJECT_ID, WORK_ITEM_ID);
      return { mutateAsync: () => editar.mutateAsync({ title: 'Editado' }) };
    });
  });

  it('eliminar un item refresca el tablero del proyecto', async () => {
    server.use(
      http.delete(
        `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await ejecutarConTableros(() => {
      const eliminar = useDeleteWorkItem(PROJECT_ID, WORK_ITEM_ID);
      return { mutateAsync: () => eliminar.mutateAsync() };
    });
  });

  it('quitar un miembro refresca el tablero del proyecto', async () => {
    server.use(
      http.delete(
        `${BASE_URL}/projects/${PROJECT_ID}/members/user_2`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await ejecutarConTableros(() => {
      const quitar = useRemoveMember(PROJECT_ID);
      return { mutateAsync: () => quitar.mutateAsync('user_2') };
    });
  });
});
