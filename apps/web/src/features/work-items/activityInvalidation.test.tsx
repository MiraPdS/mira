import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { WorkItemActivityResponse, WorkItemDto } from '@mira/shared';

import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/msw/server';
import { USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { useMoveWorkItem } from '@/features/board/useBoard';
import {
  useAssignWorkItem,
  useCreateComment,
  useDeleteWorkItem,
  useUpdateWorkItem,
  useWorkItemActivity,
} from './useWorkItems';

/**
 * MIR-22: el historial que esta en pantalla se vuelve a pedir tras cada
 * mutacion que escribe en la bitacora del elemento, y solo el de ese
 * elemento.  Se montan consumidores reales del historial y se cuentan los GET
 * que llegan a MSW: una query inactiva no se refresca, asi que sin consumidor
 * la prueba no demostraria nada.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const OTHER_PROJECT_ID = 'project_789';
const WORK_ITEM_ID = 'item_456';
const ITEM_URL = `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`;

const item: WorkItemDto = {
  id: WORK_ITEM_ID,
  reference: 'MIR-1',
  projectId: PROJECT_ID,
  title: 'Tarea de prueba',
  description: null,
  type: 'TASK',
  status: 'TODO',
  priority: 'MEDIUM',
  estimate: null,
  dueDate: null,
  assignee: null,
  createdBy: USUARIO_DE_PRUEBA,
  sprintId: null,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

/** Cuenta los GET del historial por proyecto. */
function contarPedidosDeHistorial() {
  const pedidos: Record<string, number> = { [PROJECT_ID]: 0, [OTHER_PROJECT_ID]: 0 };
  server.use(
    http.get(`${BASE_URL}/projects/:projectId/work-items/:workItemId/activity`, ({ params }) => {
      const projectId = params.projectId as string;
      pedidos[projectId] = (pedidos[projectId] ?? 0) + 1;
      return HttpResponse.json<WorkItemActivityResponse>({ data: [], truncated: false });
    }),
  );
  return pedidos;
}

/**
 * Monta el historial del elemento, el del mismo id en OTRO proyecto, y la
 * mutacion bajo prueba; espera a que ambos historiales hagan su GET inicial.
 */
async function montarConHistorial<T>(useMutacion: () => T) {
  const pedidos = contarPedidosDeHistorial();
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: 30_000 },
    mutations: { retry: false },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => ({
      historial: useWorkItemActivity(PROJECT_ID, WORK_ITEM_ID),
      otroProyecto: useWorkItemActivity(OTHER_PROJECT_ID, WORK_ITEM_ID),
      mutacion: useMutacion(),
    }),
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.historial.isSuccess).toBe(true);
    expect(result.current.otroProyecto.isSuccess).toBe(true);
  });
  expect(pedidos).toEqual({ [PROJECT_ID]: 1, [OTHER_PROJECT_ID]: 1 });

  return { result, pedidos };
}

async function comprobarRefetch(pedidos: Record<string, number>) {
  await waitFor(() => expect(pedidos[PROJECT_ID]).toBe(2));
  expect(pedidos[OTHER_PROJECT_ID]).toBe(1);
}

describe('Refresco del historial visible - MIR-22', () => {
  it('al editar el elemento', async () => {
    server.use(http.patch(ITEM_URL, () => HttpResponse.json({ item: { ...item, title: 'Otra' } })));
    const { result, pedidos } = await montarConHistorial(() =>
      useUpdateWorkItem(PROJECT_ID, WORK_ITEM_ID),
    );

    await act(async () => {
      await result.current.mutacion.mutateAsync({ title: 'Otra' });
    });

    await comprobarRefetch(pedidos);
  });

  it('al asignar o quitar el responsable (MIR-17)', async () => {
    server.use(
      http.patch(`${ITEM_URL}/assignee`, () =>
        HttpResponse.json({ item: { ...item, assignee: USUARIO_DE_PRUEBA } }),
      ),
    );
    const { result, pedidos } = await montarConHistorial(() =>
      useAssignWorkItem(PROJECT_ID, WORK_ITEM_ID),
    );

    await act(async () => {
      await result.current.mutacion.mutateAsync(USUARIO_DE_PRUEBA.id);
    });

    await comprobarRefetch(pedidos);
  });

  it('al mover la tarjeta en el tablero', async () => {
    server.use(
      http.patch(`${ITEM_URL}/status`, () =>
        HttpResponse.json({ item: { ...item, status: 'IN_PROGRESS' } }),
      ),
    );
    const { result, pedidos } = await montarConHistorial(() => useMoveWorkItem(PROJECT_ID));

    await act(async () => {
      await result.current.mutacion.mutateAsync({ item, status: 'IN_PROGRESS' });
    });

    await comprobarRefetch(pedidos);
  });

  it('al comentar', async () => {
    server.use(
      http.post(`${ITEM_URL}/comments`, () =>
        HttpResponse.json(
          {
            comment: {
              id: 'comment_1',
              body: 'Hola',
              author: USUARIO_DE_PRUEBA,
              createdAt: '2026-02-02T00:00:00.000Z',
            },
          },
          { status: 201 },
        ),
      ),
    );
    const { result, pedidos } = await montarConHistorial(() =>
      useCreateComment(PROJECT_ID, WORK_ITEM_ID),
    );

    await act(async () => {
      await result.current.mutacion.mutateAsync({ body: 'Hola' });
    });

    await comprobarRefetch(pedidos);
  });

  it('al eliminar NO vuelve a pedir el historial del elemento borrado', async () => {
    server.use(http.delete(ITEM_URL, () => new HttpResponse(null, { status: 204 })));
    const { result, pedidos } = await montarConHistorial(() =>
      useDeleteWorkItem(PROJECT_ID, WORK_ITEM_ID),
    );

    await act(async () => {
      await result.current.mutacion.mutateAsync();
    });

    // Queda marcado como obsoleto, pero el consumidor montado no lo refresca
    // (daria 404 en un elemento que ya no existe).
    await waitFor(() => expect(result.current.historial.isStale).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(pedidos).toEqual({ [PROJECT_ID]: 1, [OTHER_PROJECT_ID]: 1 });
  });
});
