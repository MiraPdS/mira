import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { Paginated, WorkItemDto } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { useUpdateWorkItem, workItemKeys } from './useWorkItems';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const OTHER_PROJECT_ID = 'project_789';
const WORK_ITEM_ID = 'item_456';
const UPDATE_URL = `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`;

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: WORK_ITEM_ID,
    reference: 'MIR-15',
    projectId: PROJECT_ID,
    title: 'Titulo original',
    description: 'Descripcion original',
    type: 'STORY',
    status: 'TODO',
    priority: 'HIGH',
    estimate: 5,
    dueDate: '2026-03-15T12:00:00.000Z',
    assignee: null,
    createdBy: {
      id: 'user_1',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    sprintId: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
    ...overrides,
  };
}

function pagina(item: WorkItemDto, projectId = PROJECT_ID): Paginated<WorkItemDto> {
  return { data: [{ ...item, projectId }], page: 1, pageSize: 20, total: 1 };
}

function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUpdateWorkItem', () => {
  it('actualiza el detalle e invalida solo el backlog del proyecto actualizado', async () => {
    const original = itemDePrueba();
    const updated = itemDePrueba({ title: 'Titulo actualizado', priority: 'CRITICAL' });
    const queryClient = crearQueryClient();
    const backlogKey = [...workItemKeys.backlog(PROJECT_ID), 1, 20] as const;
    const otherBacklogKey = [...workItemKeys.backlog(OTHER_PROJECT_ID), 1, 20] as const;
    queryClient.setQueryData(workItemKeys.detail(PROJECT_ID, WORK_ITEM_ID), original);
    queryClient.setQueryData(backlogKey, pagina(original));
    queryClient.setQueryData(otherBacklogKey, pagina(original, OTHER_PROJECT_ID));
    server.use(http.patch(UPDATE_URL, () => HttpResponse.json({ item: updated })));

    const { result } = renderHook(() => useUpdateWorkItem(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: updated.title, priority: updated.priority });
    });

    expect(queryClient.getQueryData(workItemKeys.detail(PROJECT_ID, WORK_ITEM_ID))).toEqual(
      updated,
    );
    await waitFor(() => {
      expect(queryClient.getQueryState(backlogKey)?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(otherBacklogKey)?.isInvalidated).toBe(false);
  });

  it('propaga ApiRequestError sin alterar caches cuando el servidor rechaza la actualizacion', async () => {
    const original = itemDePrueba();
    const queryClient = crearQueryClient();
    const backlogKey = [...workItemKeys.backlog(PROJECT_ID), 1, 20] as const;
    queryClient.setQueryData(workItemKeys.detail(PROJECT_ID, WORK_ITEM_ID), original);
    queryClient.setQueryData(backlogKey, pagina(original));
    server.use(
      http.patch(UPDATE_URL, () =>
        apiError(500, 'INTERNAL_ERROR', 'No se pudo actualizar el elemento'),
      ),
    );

    const { result } = renderHook(() => useUpdateWorkItem(PROJECT_ID, WORK_ITEM_ID), {
      wrapper: wrapper(queryClient),
    });
    let error: unknown;

    await act(async () => {
      try {
        await result.current.mutateAsync({ title: 'Titulo rechazado' });
      } catch (caught) {
        error = caught;
      }
    });

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(500);
    expect(queryClient.getQueryData(workItemKeys.detail(PROJECT_ID, WORK_ITEM_ID))).toEqual(
      original,
    );
    expect(queryClient.getQueryState(backlogKey)?.isInvalidated).toBe(false);
  });
});
