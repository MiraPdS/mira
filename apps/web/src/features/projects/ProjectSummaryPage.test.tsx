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

    const total = screen.getByRole('heading', {
      name: 'Total de ítems',
    }).parentElement;

    expect(total).not.toBeNull();
    expect(within(total!).getByText('5')).toBeInTheDocument();

    const estado = screen.getByRole('heading', { name: 'Por estado' }).closest('section');

    const tipo = screen.getByRole('heading', { name: 'Por tipo' }).closest('section');

    const prioridad = screen.getByRole('heading', { name: 'Por prioridad' }).closest('section');

    expect(estado).not.toBeNull();
    expect(tipo).not.toBeNull();
    expect(prioridad).not.toBeNull();

    expect(within(estado!).getByText('En progreso')).toBeInTheDocument();

    expect(within(tipo!).getByText('Historia')).toBeInTheDocument();

    expect(within(prioridad!).getByText('Alta')).toBeInTheDocument();

    expect(within(tipo!).getAllByText('2')).toHaveLength(2);
    expect(within(prioridad!).getAllByText('2')).toHaveLength(2);
  });

  it('muestra ceros y una guia cuando el proyecto esta vacio', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ summary: emptySummary })));

    renderPagina();

    expect(await screen.findByText('Este proyecto todavía no tiene ítems')).toBeInTheDocument();

    expect(
      screen.getByText('Todavía no hay actividad registrada en este proyecto.'),
    ).toBeInTheDocument();

    const estado = screen.getByRole('heading', { name: 'Por estado' }).closest('section');

    expect(estado).not.toBeNull();

    expect(within(estado!).getAllByText('0')).toHaveLength(5);
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
  it('muestra el campo modificado y sus valores anteriores y nuevos', async () => {
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

    expect(screen.getByText('cambió el estado de un ítem')).toBeInTheDocument();

    expect(screen.getByText('Estado: Por hacer → En progreso')).toBeInTheDocument();
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
