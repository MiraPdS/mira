import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  BOARD_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type BoardResponse,
  type WorkItemDto,
} from '@mira/shared';
import { renderConProviders, screen, within } from '@/test/render';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { KanbanBoard } from './KanbanBoard';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library + MSW.
 *
 * Se ejecutan el componente, TanStack Query, el hook y api-client reales.
 * MSW es el unico limite falso y representa la API HTTP.
 *
 * El desplazamiento horizontal en 375 px es CSS y jsdom no calcula layout:
 * aqui solo se verifica que exista la region desplazable y enfocable; el
 * comportamiento visual se revisa en el navegador (y con capturas en E3).
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const BOARD_URL = `${BASE_URL}/projects/:projectId/board`;

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_1',
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: 'Implementar login',
    description: null,
    type: 'TASK',
    status: 'TODO',
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
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function responderCon(items: WorkItemDto[]) {
  server.use(http.get(BOARD_URL, () => HttpResponse.json<BoardResponse>({ items })));
}

/** Lista de tarjetas de una columna, buscada por su nombre accesible. */
function tarjetasDe(status: (typeof BOARD_STATUSES)[number]) {
  return screen.getByRole('list', { name: `Tarjetas de ${STATUS_LABELS[status]}` });
}

describe('KanbanBoard', () => {
  it('muestra un estado de carga accesible mientras espera la respuesta', async () => {
    let liberar!: () => void;
    const pendiente = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.get(BOARD_URL, async () => {
        await pendiente;
        return HttpResponse.json<BoardResponse>({ items: [] });
      }),
    );

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tablero...');
    liberar();
    expect(await screen.findByRole('heading', { name: 'Tablero' })).toBeInTheDocument();
  });

  it('solicita el tablero del proyecto indicado', async () => {
    let solicitado: string | undefined;
    server.use(
      http.get(BOARD_URL, ({ params }) => {
        solicitado = params.projectId as string;
        return HttpResponse.json<BoardResponse>({ items: [] });
      }),
    );

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    await screen.findByRole('heading', { name: 'Tablero' });
    expect(solicitado).toBe(PROJECT_ID);
  });

  it('muestra las cuatro columnas en orden: Por hacer, En progreso, En revision y Hecho', async () => {
    responderCon([itemDePrueba()]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    const tablero = await screen.findByRole('region', { name: 'Columnas del tablero' });
    const titulos = within(tablero)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titulos).toEqual([
      expect.stringContaining('Por hacer'),
      expect.stringContaining('En progreso'),
      expect.stringContaining('En revision'),
      expect.stringContaining('Hecho'),
    ]);
    expect(within(tablero).queryByText(STATUS_LABELS.BACKLOG)).not.toBeInTheDocument();
  });

  it('ubica cada tarjeta en la columna de su estado', async () => {
    responderCon([
      itemDePrueba({ id: 'a', reference: 'MIR-1', title: 'Por empezar', status: 'TODO' }),
      itemDePrueba({ id: 'b', reference: 'MIR-2', title: 'Avanzando', status: 'IN_PROGRESS' }),
      itemDePrueba({ id: 'c', reference: 'MIR-3', title: 'Revisando', status: 'IN_REVIEW' }),
      itemDePrueba({ id: 'd', reference: 'MIR-4', title: 'Terminado', status: 'DONE' }),
      itemDePrueba({ id: 'e', reference: 'MIR-5', title: 'Otra mas', status: 'DONE' }),
    ]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    expect(within(tarjetasDe('TODO')).getByText('Por empezar')).toBeInTheDocument();
    expect(within(tarjetasDe('IN_PROGRESS')).getByText('Avanzando')).toBeInTheDocument();
    expect(within(tarjetasDe('IN_REVIEW')).getByText('Revisando')).toBeInTheDocument();
    expect(within(tarjetasDe('DONE')).getAllByRole('listitem')).toHaveLength(2);
    expect(within(tarjetasDe('TODO')).queryByText('Terminado')).not.toBeInTheDocument();
  });

  it('muestra en la tarjeta referencia, titulo, tipo, prioridad y responsable', async () => {
    responderCon([
      itemDePrueba({
        reference: 'MIR-7',
        title: 'Corregir la sesion',
        type: 'BUG',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        assignee: {
          id: 'user_2',
          name: 'Grace Hopper',
          email: 'grace@mira.dev',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    const tarjeta = await screen.findByRole('article', { name: 'Corregir la sesion' });
    expect(within(tarjeta).getByText('MIR-7')).toBeInTheDocument();
    expect(within(tarjeta).getByText(TYPE_LABELS.BUG)).toBeInTheDocument();
    expect(within(tarjeta).getByText(PRIORITY_LABELS.CRITICAL)).toBeInTheDocument();
    expect(within(tarjeta).getByText('Grace Hopper')).toBeInTheDocument();
    // Nunca los valores crudos del enum.
    expect(within(tarjeta).queryByText('BUG')).not.toBeInTheDocument();
    expect(within(tarjeta).queryByText('CRITICAL')).not.toBeInTheDocument();
  });

  it('indica "Sin asignar" cuando la tarjeta no tiene responsable', async () => {
    responderCon([itemDePrueba({ title: 'Sin dueno', assignee: null })]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    const tarjeta = await screen.findByRole('article', { name: 'Sin dueno' });
    expect(within(tarjeta).getByText('Sin asignar')).toBeInTheDocument();
  });

  it('mantiene visible una columna sin items, vacia y lista para recibir tarjetas', async () => {
    responderCon([itemDePrueba({ status: 'TODO' })]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    const columna = screen.getByRole('region', { name: /en revision/i });
    const lista = within(columna).getByRole('list', { name: 'Tarjetas de En revision' });
    expect(within(lista).queryAllByRole('listitem')).toHaveLength(0);
    expect(lista).toHaveAttribute('data-status', 'IN_REVIEW');
    expect(within(columna).getByText('Sin elementos')).toBeInTheDocument();
  });

  it('muestra las cuatro columnas aunque el proyecto no tenga items en el tablero', async () => {
    responderCon([]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    for (const status of BOARD_STATUSES) {
      expect(tarjetasDe(status)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Sin elementos')).toHaveLength(BOARD_STATUSES.length);
  });

  it('expone las columnas en una region desplazable enfocable con teclado', async () => {
    responderCon([]);

    const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    const tablero = await screen.findByRole('region', { name: 'Columnas del tablero' });

    await user.tab();
    expect(tablero).toHaveFocus();
  });

  it('muestra el mensaje real de un error HTTP de la API', async () => {
    server.use(
      http.get(BOARD_URL, () => apiError(403, 'FORBIDDEN', 'No tienes permisos para ver esto')),
    );

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para ver esto');
    expect(screen.queryByRole('region', { name: 'Columnas del tablero' })).not.toBeInTheDocument();
  });

  it('informa cuando la API no responde', async () => {
    server.use(http.get(BOARD_URL, () => HttpResponse.error()));

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i);
  });
});
