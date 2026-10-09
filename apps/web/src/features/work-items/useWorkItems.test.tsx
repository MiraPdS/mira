import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { Paginated, WorkItemDto } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import {
  commentsQueryKey,
  useComments,
  useDeleteWorkItem,
  useUpdateWorkItem,
  workItemKeys,
  useWorkItems,
  workItemsQueryKey,
} from './useWorkItems';

import { renderConProviders, screen } from '@/test/render';
import type { WorkItemListFilters } from './work-items.api';

const WORK_ITEMS_URL = 'http://localhost:3000/api/projects/:projectId/work-items';
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
    const backlogKey = workItemsQueryKey(PROJECT_ID, 1, 20);
    const filteredBacklogKey = workItemsQueryKey(PROJECT_ID, 2, 20, {
      type: 'BUG',
      priority: 'HIGH',
    });
    const otherBacklogKey = workItemsQueryKey(OTHER_PROJECT_ID, 1, 20, { type: 'BUG' });
    queryClient.setQueryData(workItemKeys.detail(PROJECT_ID, WORK_ITEM_ID), original);
    queryClient.setQueryData(backlogKey, pagina(original));
    queryClient.setQueryData(filteredBacklogKey, pagina(original));
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
      expect(queryClient.getQueryState(filteredBacklogKey)?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(otherBacklogKey)?.isInvalidated).toBe(false);
  });

  it('propaga ApiRequestError sin alterar caches cuando el servidor rechaza la actualizacion', async () => {
    const original = itemDePrueba();
    const queryClient = crearQueryClient();
    const backlogKey = workItemsQueryKey(PROJECT_ID, 1, 20, { q: 'Titulo', priority: 'HIGH' });
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

function queryClientConCache() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function resultado(title: string): Paginated<WorkItemDto> {
  return {
    data: [
      {
        id: title,
        reference: 'MIR-1',
        projectId: PROJECT_ID,
        title,
        description: null,
        type: 'BUG',
        status: 'BACKLOG',
        priority: 'HIGH',
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
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  };
}

function BacklogQuery({ filters }: { filters: WorkItemListFilters }) {
  const backlog = useWorkItems(PROJECT_ID, 1, 20, filters);

  if (backlog.isPending) return <p>Cargando</p>;
  if (backlog.isError) return <p>Error</p>;
  return <p>{backlog.data.data[0]?.title}</p>;
}

describe('useWorkItems', () => {
  it('usa caches distintas para combinaciones de filtros diferentes', async () => {
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const filters = new URL(request.url).searchParams;
        return HttpResponse.json(
          resultado(filters.get('type') ?? filters.get('priority') ?? 'sin filtro'),
        );
      }),
    );

    const { rerender, queryClient } = renderConProviders(
      <BacklogQuery filters={{ type: 'BUG' }} />,
      {
        queryClient: queryClientConCache(),
      },
    );
    expect(await screen.findByText('BUG')).toBeInTheDocument();

    rerender(<BacklogQuery filters={{ priority: 'HIGH' }} />);
    expect(await screen.findByText('HIGH')).toBeInTheDocument();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(2);
  });

  it('genera una key estable para la misma combinacion de filtros', async () => {
    const firstFilters = { type: 'BUG' as const, priority: 'HIGH' as const };
    const sameFilters = { priority: 'HIGH' as const, type: 'BUG' as const };

    expect(workItemsQueryKey(PROJECT_ID, 1, 20, firstFilters)).toEqual(
      workItemsQueryKey(PROJECT_ID, 1, 20, sameFilters),
    );

    server.use(http.get(WORK_ITEMS_URL, () => HttpResponse.json(resultado('BUG'))));
    const { rerender, queryClient } = renderConProviders(<BacklogQuery filters={firstFilters} />);
    await screen.findByText('BUG');

    rerender(<BacklogQuery filters={sameFilters} />);
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(1));
  });
});

describe('useDeleteWorkItem - comentarios (MIR-21)', () => {
  it('no vuelve a pedir los comentarios del elemento eliminado', async () => {
    const queryClient = crearQueryClient();
    let pedidosComentarios = 0;

    server.use(
      http.get(`${UPDATE_URL}/comments`, () => {
        pedidosComentarios += 1;
        return pedidosComentarios === 1
          ? HttpResponse.json({ comments: [] })
          : apiError(404, 'NOT_FOUND', 'Elemento de trabajo no encontrado');
      }),
      http.delete(UPDATE_URL, () => new HttpResponse(null, { status: 204 })),
    );

    // Detalle montado: los comentarios siguen observados mientras se elimina.
    const { result } = renderHook(
      () => ({
        comments: useComments(PROJECT_ID, WORK_ITEM_ID),
        deletion: useDeleteWorkItem(PROJECT_ID, WORK_ITEM_ID),
      }),
      { wrapper: wrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.comments.isSuccess).toBe(true));

    await act(async () => {
      await result.current.deletion.mutateAsync();
    });

    expect(pedidosComentarios).toBe(1);
    expect(result.current.comments.isError).toBe(false);
    expect(
      queryClient.getQueryState(commentsQueryKey(PROJECT_ID, WORK_ITEM_ID))?.isInvalidated,
    ).toBe(true);
  });
});
