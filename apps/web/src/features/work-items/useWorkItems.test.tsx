import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import type { Paginated, WorkItemDto } from '@mira/shared';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { workItemsQueryKey, useWorkItems } from './useWorkItems';
import type { WorkItemListFilters } from './work-items.api';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEMS_URL = `${BASE_URL}/projects/:projectId/work-items`;

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
