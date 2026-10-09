import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { WorkItemDto } from '@mira/shared';

import { server } from '@/test/msw/server';
import { projectKeys } from '@/features/projects/useProjects';
import { useCreateWorkItem, useUpdateWorkItem, useDeleteWorkItem } from './useWorkItems';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const OTHER_PROJECT_ID = 'project_789';
const WORK_ITEM_ID = 'item_456';

function itemDePrueba(): WorkItemDto {
  return {
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
    createdBy: {
      id: 'user_1',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    sprintId: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
}

function prepararCache() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });

  queryClient.setQueryData(projectKeys.summary(PROJECT_ID), {
    total: 1,
  });

  queryClient.setQueryData(projectKeys.summary(OTHER_PROJECT_ID), {
    total: 5,
  });

  return queryClient;
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function comprobarInvalidacion(queryClient: QueryClient) {
  await waitFor(() => {
    expect(queryClient.getQueryState(projectKeys.summary(PROJECT_ID))?.isInvalidated).toBe(true);
  });

  // No debe invalidarse el resumen de otro proyecto.
  expect(queryClient.getQueryState(projectKeys.summary(OTHER_PROJECT_ID))?.isInvalidated).toBe(
    false,
  );
}

describe('Invalidacion del resumen - MIR-23', () => {
  it('invalida el resumen al crear una tarea', async () => {
    const queryClient = prepararCache();

    server.use(
      http.post(`${BASE_URL}/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ item: itemDePrueba() }, { status: 201 }),
      ),
    );

    const { result } = renderHook(() => useCreateWorkItem(PROJECT_ID), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Nueva tarea',
        type: 'TASK',
        status: 'TODO',
        priority: 'MEDIUM',
      });
    });

    await comprobarInvalidacion(queryClient);
  });

  it('invalida el resumen al editar una tarea', async () => {
    const queryClient = prepararCache();

    server.use(
      http.patch(`${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`, () =>
        HttpResponse.json({
          item: {
            ...itemDePrueba(),
            title: 'Tarea editada',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useUpdateWorkItem(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Tarea editada',
      });
    });

    await comprobarInvalidacion(queryClient);
  });

  it('invalida el resumen al eliminar una tarea', async () => {
    const queryClient = prepararCache();

    server.use(
      http.delete(
        `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => useDeleteWorkItem(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await comprobarInvalidacion(queryClient);
  });
});
