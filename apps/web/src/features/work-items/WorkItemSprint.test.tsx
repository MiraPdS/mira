import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { ProjectRole, SprintListItemDto, WorkItemDto } from '@mira/shared';
import { QueryClient } from '@tanstack/react-query';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { COLUMNAS_DE_PRUEBA } from '@/test/columns';
import { server } from '@/test/msw/server';
import { sprintKeys } from '@/features/sprints/useSprints';
import { boardKeys } from '@/features/board/useBoard';
import { projectKeys } from '@/features/projects/useProjects';
import { WorkItemDetail } from './WorkItemDetail';
import { WorkItemBacklog } from './WorkItemBacklog';
import {
  workItemKeys,
  activityQueryKey,
  workItemsQueryKey,
  useUpdateWorkItem,
  useDeleteWorkItem,
} from './useWorkItems';
import { assignWorkItemSprint } from './work-items.api';
import { sprintsApi } from '@/features/sprints/sprints.api';

const BASE = 'http://localhost:3000/api';
const PROJECT = 'p1';
const ITEM = 'i1';
const detailUrl = `${BASE}/projects/${PROJECT}/work-items/${ITEM}`;
const dates = { createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z' };
const sprints: SprintListItemDto[] = [
  {
    id: 's1',
    projectId: PROJECT,
    name: 'Planificación',
    goal: null,
    startDate: '2026-10-29',
    endDate: '2026-11-10',
    status: 'PLANNED',
    committedPoints: null,
    completedPoints: null,
    items: 0,
    points: 0,
    ...dates,
  },
  {
    id: 's2',
    projectId: PROJECT,
    name: 'En curso',
    goal: null,
    startDate: '2026-10-29',
    endDate: '2026-11-10',
    status: 'ACTIVE',
    committedPoints: null,
    completedPoints: null,
    items: 0,
    points: 0,
    ...dates,
  },
  {
    id: 's3',
    projectId: PROJECT,
    name: 'Finalizado',
    goal: null,
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    status: 'CLOSED',
    committedPoints: null,
    completedPoints: null,
    items: 0,
    points: 0,
    ...dates,
  },
];
function workItem(sprintId: string | null = null): WorkItemDto {
  return {
    id: ITEM,
    reference: 'MIR-45',
    projectId: PROJECT,
    title: 'Asignar sprint',
    description: null,
    type: 'TASK',
    columnId: COLUMNAS_DE_PRUEBA[0]!.id,
    column: COLUMNAS_DE_PRUEBA[0]!,
    priority: 'MEDIUM',
    estimate: 5,
    dueDate: null,
    assignee: null,
    createdBy: USUARIO_DE_PRUEBA,
    sprintId,
    ...dates,
  };
}
let current: WorkItemDto;
let activity: Array<object>;
const patch = vi.fn();
function role(role: ProjectRole) {
  server.use(
    http.get(`${BASE}/auth/me`, () => HttpResponse.json({ user: USUARIO_DE_PRUEBA })),
    http.get(`${BASE}/projects/${PROJECT}/members`, () =>
      HttpResponse.json({
        members: [{ id: 'm1', role, user: USUARIO_DE_PRUEBA, joinedAt: dates.createdAt }],
      }),
    ),
  );
}
beforeEach(() => {
  current = workItem();
  activity = [];
  patch.mockReset();
  role('MEMBER');
  server.use(
    http.get(`${BASE}/projects/${PROJECT}/sprints`, () => HttpResponse.json({ data: sprints })),
    http.get(detailUrl, () => HttpResponse.json({ item: current })),
    http.get(`${detailUrl}/activity`, () =>
      HttpResponse.json({ data: activity, truncated: false }),
    ),
    http.patch(`${detailUrl}/sprint`, async ({ request }) => {
      const input = (await request.json()) as { sprintId: string | null };
      patch(input);
      current = { ...current, sprintId: input.sprintId };
      activity = [
        {
          id: 'a1',
          action: 'ITEM_UPDATED',
          field: 'sprintId',
          workItemId: ITEM,
          actor: { id: 'u1', name: 'Ada' },
          fromValue: null,
          toValue: sprints.find((sprint) => sprint.id === input.sprintId)?.name ?? null,
          createdAt: dates.updatedAt,
        },
      ];
      return HttpResponse.json({ item: current });
    }),
  );
});

describe('MIR-45 detalle', () => {
  it('una carga inicial antigua del historial no oculta la nueva asignacion', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    let release!: () => void;
    let reads = 0;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${detailUrl}/activity`, async () => {
        if (reads++ === 0) {
          await pending;
          return HttpResponse.json({ data: [], truncated: false });
        }
        return HttpResponse.json({ data: activity, truncated: false });
      }),
    );
    const { user } = renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />, {
      queryClient: client,
    });
    try {
      const selector = await screen.findByRole('combobox', { name: 'Sprint' });
      await waitFor(() => expect(selector).toBeEnabled());
      await waitFor(() => expect(reads).toBe(1));
      await user.selectOptions(selector, 's1');
      await waitFor(() =>
        expect(client.getQueryData<WorkItemDto>(workItemKeys.detail(PROJECT, ITEM))?.sprintId).toBe(
          's1',
        ),
      );
      release();
      expect(await screen.findByText(/asignó al sprint «Planificación»/)).toBeInTheDocument();
    } finally {
      release();
    }
  });
  it('una lectura anterior del detalle no sobrescribe el sprint confirmado', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const { user } = renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />, {
      queryClient: client,
    });
    const selector = await screen.findByRole('combobox', { name: 'Sprint' });
    await waitFor(() => expect(selector).toBeEnabled());
    let release!: () => void;
    let started = false;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(detailUrl, async () => {
        const previous = current;
        started = true;
        await pending;
        return HttpResponse.json({ item: previous });
      }),
    );
    const oldRead = client.refetchQueries({
      queryKey: workItemKeys.detail(PROJECT, ITEM),
      exact: true,
    });
    try {
      await waitFor(() => expect(started).toBe(true));
      await user.selectOptions(selector, 's1');
      await waitFor(() =>
        expect(client.getQueryData<WorkItemDto>(workItemKeys.detail(PROJECT, ITEM))?.sprintId).toBe(
          's1',
        ),
      );
      release();
      await oldRead;
      expect(client.getQueryData<WorkItemDto>(workItemKeys.detail(PROJECT, ITEM))?.sprintId).toBe(
        's1',
      );
      await waitFor(() => expect(selector).toHaveValue('s1'));
    } finally {
      release();
      await oldRead;
    }
  });
  it.each(['OWNER', 'MEMBER'] as const)(
    '%s asigna, muestra nombre e historial y refresca caches del proyecto',
    async (actorRole) => {
      role(actorRole);
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
          mutations: { retry: false },
        },
      });
      const keys = [
        workItemKeys.backlog(PROJECT),
        boardKeys.project(PROJECT),
        projectKeys.summary(PROJECT),
      ];
      for (const key of keys) client.setQueryData(key, {});
      client.setQueryData(sprintKeys.list('other'), sprints);
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const { user } = renderConProviders(
        <WorkItemDetail projectId={PROJECT} workItemId={ITEM} />,
        { queryClient: client },
      );
      const selector = await screen.findByRole('combobox', { name: 'Sprint' });
      await waitFor(() => expect(selector).toBeEnabled());
      expect(
        within(selector).queryByRole('option', { name: 'Finalizado' }),
      ).not.toBeInTheDocument();
      await user.selectOptions(selector, 's1');
      await waitFor(() => expect(selector).toHaveValue('s1'));
      expect(patch).toHaveBeenCalledWith({ sprintId: 's1' });
      expect(await screen.findByText(/asignó al sprint «Planificación»/)).toBeInTheDocument();
      expect(client.getQueryData<WorkItemDto>(workItemKeys.detail(PROJECT, ITEM))?.sprintId).toBe(
        's1',
      );
      for (const key of [...keys, sprintKeys.list(PROJECT)])
        expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: key }));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: activityQueryKey(PROJECT, ITEM),
        exact: true,
      });
      expect(client.getQueryState(sprintKeys.list('other'))?.isInvalidated).toBe(false);
    },
  );
  it('VIEWER ve texto sin selector ni escrituras', async () => {
    role('VIEWER');
    current = workItem('s1');
    renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />);
    expect(await screen.findByText('Planificación')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sprint' })).not.toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });
  it('muestra el actual CLOSED deshabilitado y permite quitarlo con null', async () => {
    current = workItem('s3');
    const { user } = renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />);
    const selector = await screen.findByRole('combobox', { name: 'Sprint' });
    const closed = await within(selector).findByRole('option', { name: /Finalizado.*cerrado/ });
    expect(closed).toBeDisabled();
    expect(selector).toHaveValue('s3');
    await user.selectOptions(selector, '');
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ sprintId: null }));
    await waitFor(() => expect(selector).toHaveValue(''));
  });
  it('409 muestra el error sin cambiar la asignacion confirmada y refresca opciones', async () => {
    let closed = false;
    server.use(
      http.get(`${BASE}/projects/${PROJECT}/sprints`, () =>
        HttpResponse.json({
          data: sprints.map((sprint) =>
            sprint.id === 's1' && closed ? { ...sprint, status: 'CLOSED' } : sprint,
          ),
        }),
      ),
      http.patch(`${detailUrl}/sprint`, () => {
        closed = true;
        return apiError(409, 'SPRINT_CLOSED', 'El sprint esta cerrado');
      }),
    );
    const { user } = renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />);
    const selector = await screen.findByRole('combobox', { name: 'Sprint' });
    await waitFor(() => expect(selector).toBeEnabled());
    await user.selectOptions(selector, 's1');
    expect(await screen.findByText('El sprint esta cerrado')).toBeInTheDocument();
    await waitFor(() => expect(selector).toHaveValue(''));
    await waitFor(() =>
      expect(
        within(selector).queryByRole('option', { name: 'Planificación' }),
      ).not.toBeInTheDocument(),
    );
  });
  it('deshabilita mientras guarda y muestra la opcion enviada', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch(`${detailUrl}/sprint`, async () => {
        await pending;
        current = workItem('s2');
        return HttpResponse.json({ item: current });
      }),
    );
    const { user } = renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />);
    const selector = await screen.findByRole('combobox', { name: 'Sprint' });
    await waitFor(() => expect(selector).toBeEnabled());
    await user.selectOptions(selector, 's2');
    expect(selector).toBeDisabled();
    expect(selector).toHaveValue('s2');
    release();
    await waitFor(() => expect(selector).toBeEnabled());
  });
  it('error de carga deshabilita el selector y permite reintentar', async () => {
    let fail = true;
    server.use(
      http.get(`${BASE}/projects/${PROJECT}/sprints`, () =>
        fail ? apiError(500, 'INTERNAL_ERROR', 'Error') : HttpResponse.json({ data: sprints }),
      ),
    );
    const { user } = renderConProviders(<WorkItemDetail projectId={PROJECT} workItemId={ITEM} />);
    expect(await screen.findByText('No se pudo cargar la lista de sprints.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sprint' })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Sprint' })).toBeEnabled());
  });
});

describe('MIR-45 filtro de backlog', () => {
  it('ofrece todos los estados, combina filtros, pagina y limpia sprint/sin sprint', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get(`${BASE}/projects/${PROJECT}/work-items`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        queries.push(query);
        return HttpResponse.json({
          data: [workItem()],
          total: 30,
          page: Number(query.get('page')),
          pageSize: 20,
        });
      }),
    );
    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT} />);
    const selector = await screen.findByRole('combobox', { name: 'Sprint' });
    expect(await within(selector).findByRole('option', { name: 'Finalizado' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'col_todo');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(queries.at(-1)?.get('page')).toBe('2'));
    await user.selectOptions(selector, 's1');
    await waitFor(() => expect(queries.at(-1)?.get('sprintId')).toBe('s1'));
    expect(queries.at(-1)?.get('page')).toBe('1');
    expect(queries.at(-1)?.get('columnId')).toBe('col_todo');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(queries.at(-1)?.get('page')).toBe('2'));
    expect(queries.at(-1)?.get('sprintId')).toBe('s1');
    expect(queries.at(-1)?.get('columnId')).toBe('col_todo');
    expect(queries.at(-1)?.has('status')).toBe(false);
    await user.selectOptions(selector, 'none');
    await waitFor(() => expect(queries.at(-1)?.get('sprintId')).toBe('none'));
    expect(queries.at(-1)?.get('page')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(queries.at(-1)?.has('sprintId')).toBe(false));
    expect(queries.at(-1)?.has('columnId')).toBe(false);
  });
  it('las tres variantes tienen claves de cache distintas y normalizadas', () => {
    expect(workItemsQueryKey(PROJECT, 1, 20)).not.toEqual(
      workItemsQueryKey(PROJECT, 1, 20, { sprintId: 'none' }),
    );
    expect(workItemsQueryKey(PROJECT, 1, 20, { sprintId: 's1' })).not.toEqual(
      workItemsQueryKey(PROJECT, 1, 20, { sprintId: 'none' }),
    );
    expect(workItemsQueryKey(PROJECT, 1, 20, { sprintId: ' s1 ' })).toEqual(
      workItemsQueryKey(PROJECT, 1, 20, { sprintId: 's1' }),
    );
  });
});

describe('MIR-45 clientes y metricas', () => {
  it('codifica URLs y conserva null en el body', async () => {
    let seen = '';
    server.use(
      http.patch(`${BASE}/projects/:projectId/work-items/:itemId/sprint`, async ({ request }) => {
        seen = request.url;
        expect(await request.json()).toEqual({ sprintId: null });
        return HttpResponse.json({ item: workItem() });
      }),
    );
    await assignWorkItemSprint('p /', 'i /', null);
    expect(seen).toContain('p%20%2F/work-items/i%20%2F/sprint');
  });
  it('lee los sprints de MIR-43 y propaga errores HTTP', async () => {
    expect(await sprintsApi.list(PROJECT)).toEqual(sprints);
    server.use(
      http.get(`${BASE}/projects/${PROJECT}/sprints`, () =>
        apiError(403, 'FORBIDDEN', 'Sin acceso'),
      ),
    );
    await expect(sprintsApi.list(PROJECT)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });
  it.each(['estimate', 'delete'] as const)(
    '%s invalida metricas de sprints solo del proyecto',
    async (operation) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      client.setQueryData(sprintKeys.list(PROJECT), sprints);
      client.setQueryData(sprintKeys.list('other'), sprints);
      server.use(
        http.patch(detailUrl, () =>
          HttpResponse.json({ item: { ...workItem('s1'), estimate: 8 } }),
        ),
        http.delete(detailUrl, () => new HttpResponse(null, { status: 204 })),
      );
      function Mutation() {
        const update = useUpdateWorkItem(PROJECT, ITEM);
        const remove = useDeleteWorkItem(PROJECT, ITEM);
        return (
          <button
            onClick={() =>
              operation === 'estimate' ? update.mutate({ estimate: 8 }) : remove.mutate()
            }
          >
            Ejecutar
          </button>
        );
      }
      const { user } = renderConProviders(<Mutation />, { queryClient: client });
      await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
      await waitFor(() =>
        expect(client.getQueryState(sprintKeys.list(PROJECT))?.isInvalidated).toBe(true),
      );
      expect(client.getQueryState(sprintKeys.list('other'))?.isInvalidated).toBe(false);
    },
  );
});
