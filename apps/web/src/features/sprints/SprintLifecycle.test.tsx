import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { ProjectRole, SprintListItemDto } from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError, proyectoDePrueba } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { ProjectSprintsPage } from './ProjectSprintsPage';
import { sprintKeys, useStartSprint, useCloseSprint } from './useSprints';
import { sprintsApi } from './sprints.api';

const PROJECT = 'p1';
const BASE = `http://localhost:3000/api/projects/${PROJECT}`;
const makeSprint = (id: string, status: SprintListItemDto['status']): SprintListItemDto => ({
  id,
  projectId: PROJECT,
  name: `Sprint ${id}`,
  goal: null,
  startDate: '2026-11-01',
  endDate: '2026-11-14',
  status,
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z',
  items: 2,
  points: 8,
  committedPoints: null,
  completedPoints: null,
});
let sprints: SprintListItemDto[];
const writes = vi.fn();
function role(myRole: ProjectRole) {
  server.use(
    http.get(BASE, () => HttpResponse.json({ project: proyectoDePrueba({ id: PROJECT, myRole }) })),
  );
}
function renderPage() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/sprints" element={<ProjectSprintsPage />} />
    </Routes>,
    { route: `/proyectos/${PROJECT}/sprints` },
  );
}
beforeEach(() => {
  sprints = [
    makeSprint('active', 'ACTIVE'),
    makeSprint('next', 'PLANNED'),
    { ...makeSprint('closed', 'CLOSED'), committedPoints: 13, completedPoints: 8 },
  ];
  writes.mockReset();
  role('OWNER');
  server.use(
    http.get(`${BASE}/sprints`, () => HttpResponse.json({ data: sprints })),
    http.post(`${BASE}/sprints/:id/start`, ({ params }) => {
      writes('start', params.id);
      const sprint = sprints.find((s) => s.id === params.id)!;
      sprint.status = 'ACTIVE';
      return HttpResponse.json({ sprint });
    }),
    http.post(`${BASE}/sprints/:id/close`, async ({ params, request }) => {
      writes('close', params.id, await request.json());
      const sprint = sprints.find((s) => s.id === params.id)!;
      sprint.status = 'CLOSED';
      sprint.committedPoints = 8;
      sprint.completedPoints = 3;
      return HttpResponse.json({ sprint });
    }),
  );
});
describe('MIR-46 controles del ciclo de sprint', () => {
  it('ofrece iniciar solo PLANNED, cerrar solo ACTIVE y snapshot solo CLOSED', async () => {
    renderPage();
    const planned = await screen.findByRole('article', { name: 'Sprint next' });
    const active = screen.getByRole('article', { name: 'Sprint active' });
    const closed = screen.getByRole('article', { name: 'Sprint closed' });
    expect(within(planned).getByRole('button', { name: 'Iniciar sprint' })).toBeInTheDocument();
    expect(
      within(planned).queryByRole('button', { name: 'Cerrar sprint' }),
    ).not.toBeInTheDocument();
    expect(within(active).getByRole('button', { name: 'Cerrar sprint' })).toBeInTheDocument();
    expect(
      within(active).queryByRole('button', { name: 'Iniciar sprint' }),
    ).not.toBeInTheDocument();
    expect(
      within(closed).queryByRole('button', { name: /Iniciar sprint|Cerrar sprint/ }),
    ).not.toBeInTheDocument();
    expect(within(closed).getByText('Puntos comprometidos').nextSibling).toHaveTextContent('13');
    expect(within(closed).getByText('Puntos completados').nextSibling).toHaveTextContent('8');
    expect(within(active).queryByText('Puntos comprometidos')).not.toBeInTheDocument();
  });
  it.each(['OWNER', 'MEMBER'] as const)('%s confirma inicio y refresca lista', async (r) => {
    role(r);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Iniciar sprint' }));
    const dialog = screen.getByRole('dialog', { name: 'Iniciar sprint: Sprint next' });
    expect(writes).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(writes).toHaveBeenCalledWith('start', 'next'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      within(screen.getByRole('article', { name: 'Sprint next' })).getByRole('button', {
        name: 'Cerrar sprint',
      }),
    ).toBeInTheDocument();
  });
  it('cancelar inicio/cierre y Escape no envian peticiones', async () => {
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Iniciar sprint' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sprint' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
  });
  it.each(['', 'next'])(
    'cierra con destino %s y muestra metricas confirmadas',
    async (destination) => {
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'Cerrar sprint' }));
      const dialog = screen.getByRole('dialog', { name: 'Cerrar sprint: Sprint active' });
      expect(within(dialog).getByText(/Solo los elementos no terminados/)).toBeInTheDocument();
      const select = within(dialog).getByRole('combobox', {
        name: 'Destino de los elementos no terminados',
      });
      expect(
        within(select)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Backlog', 'Sprint next']);
      await user.selectOptions(select, destination);
      await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
      await waitFor(() =>
        expect(writes).toHaveBeenCalledWith('close', 'active', {
          moveUnfinishedToSprintId: destination || null,
        }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const card = screen.getByRole('article', { name: 'Sprint active' });
      expect(within(card).getByText('Puntos completados').nextSibling).toHaveTextContent('3');
    },
  );
  it.each(['start', 'close'])('409 de %s queda visible sin cambiar estado', async (action) => {
    server.use(
      http.post(`${BASE}/sprints/:id/${action}`, () =>
        apiError(409, 'SPRINT_CONFLICT', 'El sprint cambio mientras tanto'),
      ),
    );
    const { user } = renderPage();
    await user.click(
      await screen.findByRole('button', {
        name: action === 'start' ? 'Iniciar sprint' : 'Cerrar sprint',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El sprint cambio mientras tanto');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('deshabilita confirmacion y cancelacion mientras guarda', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${BASE}/sprints/next/start`, async () => {
        await pending;
        return HttpResponse.json({ sprint: makeSprint('next', 'ACTIVE') });
      }),
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Iniciar sprint' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('VIEWER solo visualiza y no inventa puntos para cierres heredados', async () => {
    role('VIEWER');
    sprints[2]!.committedPoints = null;
    sprints[2]!.completedPoints = null;
    renderPage();
    const closed = await screen.findByRole('article', { name: 'Sprint closed' });
    expect(within(closed).getAllByText('No disponible')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: /Iniciar sprint|Cerrar sprint/ }),
    ).not.toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
  });
});
describe('MIR-46 cache y cliente de sprints existentes', () => {
  it.each(['start', 'close'])(
    '%s invalida todas las vistas afectadas solo del proyecto',
    async (action) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      const keys = [
        sprintKeys.list(PROJECT),
        ['board', PROJECT],
        ['board', PROJECT, 'columns'],
        ['projects', PROJECT, 'summary'],
        ['work-items', 'backlog', PROJECT, 1, 20, {}],
        ['work-item', PROJECT, 'i1'],
        ['work-item-activity', PROJECT, 'i1'],
      ];
      const others = [
        sprintKeys.list('other'),
        ['board', 'other'],
        ['projects', 'other', 'summary'],
        ['work-items', 'backlog', 'other'],
        ['work-item', 'other', 'i1'],
        ['comments', PROJECT, 'i1'],
      ];
      for (const key of [...keys, ...others]) client.setQueryData(key, []);
      function Mutation() {
        const start = useStartSprint(PROJECT, 'next');
        const close = useCloseSprint(PROJECT, 'active');
        return (
          <button
            onClick={() =>
              action === 'start' ? start.mutate() : close.mutate({ moveUnfinishedToSprintId: null })
            }
          >
            Ejecutar
          </button>
        );
      }
      const { user } = renderConProviders(<Mutation />, { queryClient: client });
      await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
      await waitFor(() => {
        for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      });
      for (const key of others) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    },
  );
  it('codifica ids y envia null sin crear otro cliente', async () => {
    const urls: string[] = [];
    server.use(
      http.post(
        'http://localhost:3000/api/projects/:projectId/sprints/:id/:action',
        async ({ request, params }) => {
          urls.push(request.url);
          if (params.action === 'close')
            expect(await request.json()).toEqual({ moveUnfinishedToSprintId: null });
          return HttpResponse.json({ sprint: makeSprint('s1', 'ACTIVE') });
        },
      ),
    );
    await sprintsApi.start('p /', 's /');
    await sprintsApi.close('p /', 's /', { moveUnfinishedToSprintId: null });
    expect(urls).toEqual([
      'http://localhost:3000/api/projects/p%20%2F/sprints/s%20%2F/start',
      'http://localhost:3000/api/projects/p%20%2F/sprints/s%20%2F/close',
    ]);
  });
});
