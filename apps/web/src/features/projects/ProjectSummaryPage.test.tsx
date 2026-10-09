import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderConProviders, screen, within } from '@/test/render';
import { server } from '@/test/msw/server';
import { ProjectSummaryPage } from './ProjectSummaryPage';

const PROJECT_ID = 'project_1';
const ENDPOINT = `http://localhost:3000/api/projects/${PROJECT_ID}/summary`;

const emptySummary = {
  total: 0,
  byStatus: {
    BACKLOG: 0,
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  },
  byType: {
    EPIC: 0,
    STORY: 0,
    TASK: 0,
    BUG: 0,
  },
  byPriority: {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  },
  recentActivity: [],
};

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId" element={<ProjectSummaryPage />} />
    </Routes>,
    {
      route: `/proyectos/${PROJECT_ID}`,
    },
  );
}

describe('ProjectSummaryPage - MIR-23', () => {
  it('enlaza al backlog antes del tablero y los miembros del proyecto', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ summary: emptySummary })));
    renderPagina();

    const navigation = await screen.findByRole('navigation', { name: 'Secciones del proyecto' });
    const links = within(navigation).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Ver backlog →',
      'Ver tablero →',
      'Ver miembros del proyecto →',
    ]);
    expect(links[0]).toHaveAttribute('href', `/proyectos/${PROJECT_ID}/backlog`);
    expect(links[1]).toHaveAttribute('href', `/proyectos/${PROJECT_ID}/tablero`);
    expect(links[2]).toHaveAttribute('href', `/proyectos/${PROJECT_ID}/miembros`);
  });

  it('muestra los conteos por estado, tipo y prioridad', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({
          summary: {
            ...emptySummary,
            total: 5,
            byStatus: {
              BACKLOG: 1,
              TODO: 1,
              IN_PROGRESS: 1,
              IN_REVIEW: 1,
              DONE: 1,
            },
            byType: {
              EPIC: 0,
              STORY: 2,
              TASK: 2,
              BUG: 1,
            },
            byPriority: {
              LOW: 1,
              MEDIUM: 2,
              HIGH: 2,
              CRITICAL: 0,
            },
          },
        }),
      ),
    );

    renderPagina();

    expect(await screen.findByText('Resumen del proyecto')).toBeInTheDocument();

    const total = screen.getByRole('region', { name: 'Total de ítems' });
    expect(within(total).getByText('5')).toBeInTheDocument();

    const estado = screen.getByRole('region', { name: 'Por estado' });
    const tipo = screen.getByRole('region', { name: 'Por tipo' });
    const prioridad = screen.getByRole('region', { name: 'Por prioridad' });

    expect(within(estado).getByText('En progreso')).toBeInTheDocument();
    expect(within(tipo).getByText('Historia')).toBeInTheDocument();
    expect(within(prioridad).getByText('Alta')).toBeInTheDocument();

    expect(within(tipo).getAllByText('2')).toHaveLength(2);
    expect(within(prioridad).getAllByText('2')).toHaveLength(2);
  });

  it('muestra ceros y una guia cuando el proyecto esta vacio', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ summary: emptySummary })));

    renderPagina();

    expect(await screen.findByText('Este proyecto todavía no tiene ítems')).toBeInTheDocument();

    expect(
      screen.getByText('Todavía no hay actividad registrada en este proyecto.'),
    ).toBeInTheDocument();

    const estado = screen.getByRole('region', { name: 'Por estado' });
    expect(within(estado).getAllByText('0')).toHaveLength(5);
  });

  it('muestra la actividad reciente del proyecto', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({
          summary: {
            ...emptySummary,
            total: 1,
            recentActivity: [
              {
                id: 'activity_1',
                action: 'ITEM_CREATED',
                workItemId: 'item_1',
                actor: {
                  id: 'user_1',
                  name: 'Ada Lovelace',
                },
                field: null,
                fromValue: null,
                toValue: null,
                createdAt: '2026-10-08T12:00:00.000Z',
              },
            ],
          },
        }),
      ),
    );

    renderPagina();

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();

    expect(screen.getByText(/creó un ítem/i)).toBeInTheDocument();
  });

  // MIR-23: Verifica que la actividad muestre el detalle del cambio.
  it('describe el cambio de estado en lenguaje natural', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({
          summary: {
            ...emptySummary,
            total: 1,
            recentActivity: [
              {
                id: 'activity_status_1',
                action: 'ITEM_STATUS_CHANGED',
                workItemId: 'item_1',
                actor: {
                  id: 'user_1',
                  name: 'Ada Lovelace',
                },
                field: 'status',
                fromValue: 'TODO',
                toValue: 'IN_PROGRESS',
                createdAt: '2026-10-08T12:00:00.000Z',
              },
            ],
          },
        }),
      ),
    );

    renderPagina();

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();

    expect(screen.getByText('movió un ítem de Por hacer a En progreso')).toBeInTheDocument();
    expect(screen.queryByText(/IN_PROGRESS|status/)).not.toBeInTheDocument();
  });

  function conActividad(actividad: Record<string, unknown>) {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({
          summary: {
            ...emptySummary,
            recentActivity: [
              {
                id: 'activity_1',
                workItemId: null,
                actor: { id: 'user_1', name: 'Ada Lovelace' },
                fromValue: null,
                toValue: null,
                createdAt: '2026-10-08T12:00:00.000Z',
                ...actividad,
              },
            ],
          },
        }),
      ),
    );
  }

  it('traduce el rol con ROLE_LABELS', async () => {
    conActividad({
      action: 'MEMBER_ROLE_CHANGED',
      field: 'role',
      fromValue: 'MEMBER',
      toValue: 'VIEWER',
    });

    renderPagina();

    expect(
      await screen.findByText('cambió el rol de un miembro de Miembro a Observador'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/VIEWER/)).not.toBeInTheDocument();
  });

  it('muestra el nombre del miembro agregado, no su id', async () => {
    conActividad({ action: 'MEMBER_ADDED', field: 'member', toValue: 'Grace Hopper' });

    renderPagina();

    expect(await screen.findByText('agregó a Grace Hopper al proyecto')).toBeInTheDocument();
    expect(screen.queryByText(/member:/)).not.toBeInTheDocument();
  });

  it('muestra el cambio de responsable con nombres', async () => {
    conActividad({
      action: 'ITEM_UPDATED',
      workItemId: 'item_1',
      field: 'assigneeId',
      fromValue: 'Ada Lovelace',
      toValue: 'Alan Turing',
    });

    renderPagina();

    expect(await screen.findByText('asignó un ítem a Alan Turing')).toBeInTheDocument();
  });

  it('describe la edicion del proyecto (MIR-7)', async () => {
    conActividad({
      action: 'PROJECT_UPDATED',
      field: 'name',
      fromValue: 'Mira',
      toValue: 'Mira 2',
    });

    renderPagina();

    expect(
      await screen.findByText('cambió el nombre del proyecto de «Mira» a «Mira 2»'),
    ).toBeInTheDocument();
  });

  it('enlaza al tablero y a los miembros del proyecto', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ summary: emptySummary })));

    renderPagina();

    expect(await screen.findByRole('link', { name: /Ver tablero/ })).toHaveAttribute(
      'href',
      `/proyectos/${PROJECT_ID}/tablero`,
    );
    expect(screen.getByRole('link', { name: /Ver miembros/ })).toHaveAttribute(
      'href',
      `/proyectos/${PROJECT_ID}/miembros`,
    );
  });

  it('muestra un mensaje cuando falla la consulta', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json(
          {
            error: {
              code: 'PROJECT_ACCESS_DENIED',
              message: 'Acceso denegado',
            },
          },
          { status: 403 },
        ),
      ),
    );

    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible cargar el resumen del proyecto.',
    );

    expect(screen.getByText('Volver a proyectos')).toBeInTheDocument();
  });
});
