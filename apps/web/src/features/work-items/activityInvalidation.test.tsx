import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { WorkItemDto } from '@mira/shared';

import { server } from '@/test/msw/server';
import { USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { useMoveWorkItem } from '@/features/board/useBoard';
import {
  activityQueryKey,
  useCreateComment,
  useDeleteWorkItem,
  useUpdateWorkItem,
} from './useWorkItems';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEM_ID = 'item_456';
const OTHER_ITEM_ID = 'item_789';
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

const vacio = { data: [], truncated: false };

function prepararCache() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
  });
  queryClient.setQueryData(activityQueryKey(PROJECT_ID, WORK_ITEM_ID), vacio);
  queryClient.setQueryData(activityQueryKey(PROJECT_ID, OTHER_ITEM_ID), vacio);
  return queryClient;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function comprobarInvalidacion(queryClient: QueryClient) {
  await waitFor(() => {
    expect(
      queryClient.getQueryState(activityQueryKey(PROJECT_ID, WORK_ITEM_ID))?.isInvalidated,
    ).toBe(true);
  });
  // El historial de otro elemento no se toca.
  expect(
    queryClient.getQueryState(activityQueryKey(PROJECT_ID, OTHER_ITEM_ID))?.isInvalidated,
  ).toBe(false);
}

describe('Invalidacion del historial - MIR-22', () => {
  it('al editar el elemento', async () => {
    const queryClient = prepararCache();
    server.use(http.patch(ITEM_URL, () => HttpResponse.json({ item: { ...item, title: 'Otra' } })));

    const { result } = renderHook(() => useUpdateWorkItem(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ title: 'Otra' });
    });

    await comprobarInvalidacion(queryClient);
  });

  it('al mover la tarjeta en el tablero', async () => {
    const queryClient = prepararCache();
    server.use(
      http.patch(`${ITEM_URL}/status`, () =>
        HttpResponse.json({ item: { ...item, status: 'IN_PROGRESS' } }),
      ),
    );

    const { result } = renderHook(() => useMoveWorkItem(PROJECT_ID), {
      wrapper: wrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ item, status: 'IN_PROGRESS' });
    });

    await comprobarInvalidacion(queryClient);
  });

  it('al comentar', async () => {
    const queryClient = prepararCache();
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

    const { result } = renderHook(() => useCreateComment(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ body: 'Hola' });
    });

    await comprobarInvalidacion(queryClient);
  });

  it('al eliminar, sin volver a pedir el historial del elemento borrado', async () => {
    const queryClient = prepararCache();
    let pedidos = 0;
    server.use(
      http.delete(ITEM_URL, () => new HttpResponse(null, { status: 204 })),
      http.get(`${ITEM_URL}/activity`, () => {
        pedidos += 1;
        return HttpResponse.json(vacio);
      }),
    );

    const { result } = renderHook(() => useDeleteWorkItem(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    await comprobarInvalidacion(queryClient);
    expect(pedidos).toBe(0);
  });
});
