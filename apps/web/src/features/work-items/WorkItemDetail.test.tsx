import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { ProjectRole, WorkItemDto } from '@mira/shared';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { WorkItemDetail } from './WorkItemDetail';
import { useWorkItems } from './useWorkItems';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library + MSW.
 *
 * No se mockean el hook, la API ni el cliente HTTP: MSW es el unico limite
 * falso y la prueba recorre la misma cadena de consultas de produccion.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEM_ID = 'item_456';
const DETAIL_URL = `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`;

// JSDOM no implementa showModal: solo suplimos la API del navegador,
// sin sustituir componentes, hooks ni el cliente HTTP.
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
beforeAll(() =>
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  }),
);
afterAll(() => {
  if (originalShowModal)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});

function responderConRol(role: ProjectRole | null) {
  server.use(
    http.get(`${BASE_URL}/auth/me`, () => HttpResponse.json({ user: USUARIO_DE_PRUEBA })),
    http.get(`${BASE_URL}/projects/*/members`, () =>
      HttpResponse.json({
        members: [
          {
            id: 'membership_other',
            role: 'OWNER',
            user: { ...USUARIO_DE_PRUEBA, id: 'other_user' },
          },
          ...(role ? [{ id: 'membership_123', role, user: USUARIO_DE_PRUEBA }] : []),
        ],
      }),
    ),
  );
}

beforeEach(() => responderConRol('MEMBER'));

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: WORK_ITEM_ID,
    reference: 'MIR-14',
    projectId: PROJECT_ID,
    title: 'Ver el detalle de un elemento',
    description: 'Como miembro quiero revisar toda la informacion del elemento.',
    type: 'STORY',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    estimate: 5,
    dueDate: '2026-03-15T12:00:00.000Z',
    assignee: {
      id: 'user_2',
      name: 'Grace Hopper',
      email: 'grace@mira.dev',
      createdAt: '2026-01-03T04:05:06.000Z',
    },
    createdBy: {
      id: 'user_1',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-02T03:04:05.000Z',
    },
    sprintId: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-02T11:30:00.000Z',
    ...overrides,
  };
}

function responderConItem(item: WorkItemDto = itemDePrueba()) {
  server.use(http.get(DETAIL_URL, () => HttpResponse.json({ item })));
}

describe('WorkItemDetail', () => {
  it('muestra no encontrado si falta el identificador y no queda cargando', () => {
    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId="" />);

    expect(screen.getByRole('heading', { name: 'Elemento no encontrado' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('muestra un estado de carga accesible antes de recibir el detalle', async () => {
    let releaseResponse!: () => void;
    const responsePending = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.get(DETAIL_URL, async () => {
        await responsePending;
        return HttpResponse.json({ item: itemDePrueba() });
      }),
    );

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando elemento...');
    expect(
      screen.queryByRole('heading', { name: 'Ver el detalle de un elemento' }),
    ).not.toBeInTheDocument();

    releaseResponse();
    expect(
      await screen.findByRole('heading', { name: 'Ver el detalle de un elemento' }),
    ).toBeInTheDocument();
  });

  it('renderiza el detalle completo y solicita la URL correcta una sola vez', async () => {
    const item = itemDePrueba();
    const requests: Request[] = [];
    server.use(
      http.get(DETAIL_URL, ({ request }) => {
        requests.push(request);
        return HttpResponse.json({ item });
      }),
    );

    const { container } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );

    expect(await screen.findByRole('heading', { name: item.title })).toBeInTheDocument();
    expect(screen.getByText(item.reference)).toBeInTheDocument();
    expect(screen.getByText(item.description!)).toBeInTheDocument();
    expect(screen.getByText('Historia')).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('5 puntos')).toBeInTheDocument();
    expect(screen.getByText('Fecha límite')).toBeInTheDocument();
    expect(screen.getByText('Fecha de creación')).toBeInTheDocument();
    expect(screen.getByText('Última actualización')).toBeInTheDocument();

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toBe(DETAIL_URL);
    await expect(requests[0]?.text()).resolves.toBe('');

    // Los atributos datetime son el contrato estable; el texto localizado puede variar por entorno.
    expect(container.querySelector(`time[datetime="${item.dueDate}"]`)).toBeInTheDocument();
    expect(container.querySelector(`time[datetime="${item.createdAt}"]`)).toBeInTheDocument();
    expect(container.querySelector(`time[datetime="${item.updatedAt}"]`)).toBeInTheDocument();
  });

  it('muestra textos explicitos para los campos nullable', async () => {
    responderConItem(
      itemDePrueba({ description: null, assignee: null, estimate: null, dueDate: null }),
    );

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(await screen.findByText('Sin descripción')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    expect(screen.getByText('Sin estimar')).toBeInTheDocument();
    expect(screen.getByText('Sin fecha límite')).toBeInTheDocument();
  });

  it('muestra un estado de no encontrado para 404 NOT_FOUND sin alert generico', async () => {
    server.use(
      http.get(DETAIL_URL, () => apiError(404, 'NOT_FOUND', 'Elemento de trabajo no encontrado')),
    );

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(
      await screen.findByRole('heading', { name: 'Elemento no encontrado' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el mensaje de un error HTTP generico en un alert', async () => {
    server.use(
      http.get(DETAIL_URL, () => apiError(500, 'INTERNAL_ERROR', 'Error interno de prueba')),
    );

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno de prueba');
  });

  it('muestra el mensaje del cliente cuando falla la red', async () => {
    server.use(http.get(DETAIL_URL, () => HttpResponse.error()));

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor. Revisa tu conexion.',
    );
  });

  it('codifica los identificadores al solicitar el detalle', async () => {
    const projectId = 'project/con espacio';
    const workItemId = 'item/123';
    const encodedUrl = `${BASE_URL}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(
      workItemId,
    )}`;
    const requests: Request[] = [];
    server.use(
      http.get(encodedUrl, ({ request }) => {
        requests.push(request);
        return HttpResponse.json({ item: itemDePrueba({ projectId, id: workItemId }) });
      }),
    );

    renderConProviders(<WorkItemDetail projectId={projectId} workItemId={workItemId} />);

    await screen.findByRole('heading', { name: 'Ver el detalle de un elemento' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toBe(encodedUrl);
  });
});

describe('eliminación desde WorkItemDetail', () => {
  beforeEach(() => responderConItem());

  it('no conserva la eliminación anterior al cambiar de item sin desmontar el contenedor', async () => {
    const nextItem = itemDePrueba({ id: 'item_next', reference: 'MIR-20', title: 'Otro elemento' });
    server.use(
      http.delete(DETAIL_URL, () => new HttpResponse(null, { status: 204 })),
      http.get(`${BASE_URL}/projects/${PROJECT_ID}/work-items/${nextItem.id}`, () =>
        HttpResponse.json({ item: nextItem }),
      ),
    );
    const { user, rerender } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await screen.findByText('Elemento eliminado.');

    rerender(<WorkItemDetail projectId={PROJECT_ID} workItemId={nextItem.id} />);
    expect(await screen.findByRole('heading', { name: nextItem.title })).toBeInTheDocument();
    expect(screen.queryByText('Elemento eliminado.')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('MIR-20: Otro elemento');
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s ve la acción usando su membresía real',
    async (role) => {
      responderConRol(role);
      renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);
      expect(await screen.findByRole('button', { name: 'Eliminar elemento' })).toBeInTheDocument();
    },
  );

  it.each(['VIEWER', null] as const)('rol %s no obtiene permiso del OWNER ajeno', async (role) => {
    responderConRol(role);
    const { queryClient } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );
    await screen.findByRole('heading', { name: itemDePrueba().title });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByRole('button', { name: 'Eliminar elemento' })).not.toBeInTheDocument();
  });

  it('abre confirmación con referencia y título; cancelar no envía DELETE', async () => {
    const requests: Request[] = [];
    server.use(
      http.delete(DETAIL_URL, ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
    expect(screen.getByRole('dialog', { name: 'Eliminar elemento' })).toHaveTextContent(
      'MIR-14: Ver el detalle de un elemento',
    );
    expect(requests).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('confirma exactamente un DELETE, acepta 204 y llama onDeleted sin requerir navegación', async () => {
    const requests: Request[] = [];
    const onDeleted = vi.fn();
    server.use(
      http.delete(DETAIL_URL, ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, queryClient } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} onDeleted={onDeleted} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('DELETE');
    expect(requests[0]?.url).toBe(DETAIL_URL);
    await expect(requests[0]?.text()).resolves.toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('Elemento eliminado.');
    expect(queryClient.getQueryState(['work-item', PROJECT_ID, WORK_ITEM_ID])?.isInvalidated).toBe(
      true,
    );
  });

  it('bloquea doble envío y cancelación mientras elimina', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    server.use(
      http.delete(DETAIL_URL, async () => {
        requests++;
        await pending;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
    await user.dblClick(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByRole('button', { name: 'Eliminando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await waitFor(() => expect(requests).toBe(1));
    release();
    await screen.findByText('Elemento eliminado.');
  });

  it.each([403, 500, 'red'] as const)(
    'error %s conserva detalle, muestra alerta y no llama onDeleted',
    async (status) => {
      const onDeleted = vi.fn();
      server.use(
        http.delete(DETAIL_URL, () =>
          status === 'red'
            ? HttpResponse.error()
            : apiError(status, 'DELETE_ERROR', 'No se pudo eliminar'),
        ),
      );
      const { user, queryClient } = renderConProviders(
        <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} onDeleted={onDeleted} />,
      );
      await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
      await user.click(screen.getByRole('button', { name: 'Eliminar' }));
      expect(
        await screen.findByText(
          status === 'red' ? /No se pudo conectar con el servidor/ : 'No se pudo eliminar',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: itemDePrueba().title })).toBeInTheDocument();
      expect(onDeleted).not.toHaveBeenCalled();
      expect(
        queryClient.getQueryState(['work-item', PROJECT_ID, WORK_ITEM_ID])?.isInvalidated,
      ).toBe(false);
    },
  );

  it('refresca el backlog e invalida otras vistas de work-items solo del mismo proyecto', async () => {
    let deleted = false;
    let listRequests = 0;
    server.use(
      http.get(`${BASE_URL}/projects/${PROJECT_ID}/work-items`, () => {
        listRequests++;
        return HttpResponse.json({
          data: deleted ? [] : [itemDePrueba()],
          total: deleted ? 0 : 1,
          page: 1,
          pageSize: 10,
        });
      }),
      http.delete(DETAIL_URL, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    function Backlog() {
      const { data } = useWorkItems(PROJECT_ID, 1, 10);
      return <p>Resultados: {data?.total}</p>;
    }
    const { user, queryClient } = renderConProviders(
      <>
        <Backlog />
        <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />
      </>,
    );
    // El render helper usa gcTime: 0; aquí verificamos también queries inactivas.
    queryClient.setQueryDefaults(['work-items'], { gcTime: Infinity });
    queryClient.setQueryData(['work-items', 'board', PROJECT_ID], ['cached']);
    queryClient.setQueryData(['work-items', 'backlog', PROJECT_ID, 2, 10], ['cached']);
    queryClient.setQueryData(['work-items', 'backlog', 'other-project', 1, 10], ['other']);
    await screen.findByText('Resultados: 1');
    await user.click(await screen.findByRole('button', { name: 'Eliminar elemento' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await screen.findByText('Resultados: 0');
    expect(listRequests).toBe(2);
    expect(queryClient.getQueryState(['work-items', 'board', PROJECT_ID])?.isInvalidated).toBe(
      true,
    );
    expect(
      queryClient.getQueryState(['work-items', 'backlog', PROJECT_ID, 2, 10])?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(['work-items', 'backlog', 'other-project', 1, 10])?.isInvalidated,
    ).toBe(false);
  });
});
