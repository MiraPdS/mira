import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { ActivityDto, WorkItemActivityResponse, WorkItemDto } from '@mira/shared';
import { fireEvent, renderConProviders, screen, within } from '@/test/render';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { WorkItemDetail } from './WorkItemDetail';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEM_ID = 'item_456';
const DETAIL_URL = `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`;
const ACTIVITY_URL = `${DETAIL_URL}/activity`;

const item: WorkItemDto = {
  id: WORK_ITEM_ID,
  reference: 'MIR-22',
  projectId: PROJECT_ID,
  title: 'Historial de cambios',
  description: null,
  type: 'STORY',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  estimate: null,
  dueDate: null,
  assignee: null,
  createdBy: USUARIO_DE_PRUEBA,
  sprintId: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

function entrada(overrides: Partial<ActivityDto>): ActivityDto {
  return {
    id: 'activity_1',
    action: 'ITEM_CREATED',
    workItemId: WORK_ITEM_ID,
    actor: { id: 'user_1', name: 'Ada Lovelace' },
    field: null,
    fromValue: null,
    toValue: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function conHistorial(response: WorkItemActivityResponse) {
  server.use(http.get(ACTIVITY_URL, () => HttpResponse.json(response)));
}

function renderDetalle() {
  renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);
}

async function seccionHistorial() {
  return screen.findByRole('region', { name: 'Historial' });
}

beforeEach(() => {
  server.use(
    http.get(DETAIL_URL, () => HttpResponse.json({ item })),
    // El detalle consulta los miembros para decidir sus acciones; el historial
    // no depende del rol (VIEWER tambien lo ve).
    http.get(`${BASE_URL}/projects/${PROJECT_ID}/members`, () =>
      HttpResponse.json({
        members: [{ id: 'membership_1', role: 'VIEWER', user: USUARIO_DE_PRUEBA }],
      }),
    ),
  );
});

describe('MIR-22 - historial de un elemento', () => {
  it('muestra cada cambio en lenguaje natural, con actor y fecha, en el orden recibido', async () => {
    conHistorial({
      data: [
        entrada({
          id: 'activity_2',
          action: 'ITEM_STATUS_CHANGED',
          actor: { id: 'user_2', name: 'Grace Hopper' },
          field: 'status',
          fromValue: 'TODO',
          toValue: 'IN_PROGRESS',
          createdAt: '2026-10-02T10:00:00.000Z',
        }),
        entrada({ id: 'activity_1' }),
      ],
      truncated: false,
    });

    renderDetalle();

    const historial = await seccionHistorial();
    const entradas = await within(historial).findAllByRole('listitem');
    expect(entradas).toHaveLength(2);
    expect(entradas[0]).toHaveTextContent('Grace Hopper movió de Por hacer a En progreso');
    expect(entradas[1]).toHaveTextContent('Ada Lovelace creó el ítem');
    expect(within(entradas[0]!).getByText(/2026/)).toHaveAttribute(
      'dateTime',
      '2026-10-02T10:00:00.000Z',
    );
    expect(historial).not.toHaveTextContent(/IN_PROGRESS|status/);
  });

  it('muestra un estado vacio orientador', async () => {
    renderDetalle();

    const historial = await seccionHistorial();
    expect(
      await within(historial).findByText('Todavía no hay cambios registrados.'),
    ).toBeInTheDocument();
  });

  it('avisa cuando solo se muestran los cambios mas recientes', async () => {
    conHistorial({ data: [entrada({})], truncated: true });

    renderDetalle();

    const historial = await seccionHistorial();
    expect(
      await within(historial).findByText('Mostrando los 100 cambios más recientes.'),
    ).toBeInTheDocument();
  });

  it('permite reintentar tras un error del servidor', async () => {
    let intentos = 0;
    server.use(
      http.get(ACTIVITY_URL, () => {
        intentos += 1;
        return intentos === 1
          ? apiError(500, 'INTERNAL', 'Error interno')
          : HttpResponse.json({ data: [entrada({})], truncated: false });
      }),
    );

    renderDetalle();

    const historial = await seccionHistorial();
    expect(await within(historial).findByRole('alert')).toHaveTextContent(
      'No se pudo cargar el historial.',
    );

    fireEvent.click(within(historial).getByRole('button', { name: 'Reintentar' }));

    expect(await within(historial).findByText(/creó el ítem/)).toBeInTheDocument();
  });

  it.each([
    [404, 'NOT_FOUND', 'Este elemento ya no existe.'],
    [403, 'FORBIDDEN', 'No tienes acceso al historial de este elemento.'],
  ])('con %i no ofrece reintentar', async (status, code, mensaje) => {
    server.use(http.get(ACTIVITY_URL, () => apiError(status, code, 'No disponible')));

    renderDetalle();

    const historial = await seccionHistorial();
    expect(await within(historial).findByRole('alert')).toHaveTextContent(mensaje);
    expect(within(historial).queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
