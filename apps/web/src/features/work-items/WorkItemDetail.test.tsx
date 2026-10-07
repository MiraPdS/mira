import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { WorkItemDto } from '@mira/shared';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { WorkItemDetail } from './WorkItemDetail';

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
const UPDATE_URL = DETAIL_URL;

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

  it.each(['OWNER', 'MEMBER'] as const)('muestra Editar a un %s', async (role) => {
    responderConItem();

    renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role={role} />,
    );

    await screen.findByRole('heading', { name: 'Ver el detalle de un elemento' });
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('mantiene a VIEWER en modo lectura sin exponer el editor', async () => {
    const item = itemDePrueba();
    responderConItem(item);

    renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="VIEWER" />,
    );

    expect(await screen.findByRole('heading', { name: item.title })).toBeInTheDocument();
    expect(screen.getByText(item.description!)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Editar elemento' })).not.toBeInTheDocument();
  });

  it('precarga el formulario con los campos editables actuales', async () => {
    const item = itemDePrueba();
    responderConItem(item);
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="MEMBER" />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar' }));

    expect(screen.getByRole('heading', { name: 'Editar elemento' })).toBeInTheDocument();
    expect(screen.getByLabelText('Titulo')).toHaveValue(item.title);
    expect(screen.getByLabelText('Descripcion')).toHaveValue(item.description);
    expect(screen.getByLabelText('Tipo')).toHaveValue(item.type);
    expect(screen.getByLabelText('Prioridad')).toHaveValue(item.priority);
    expect(screen.getByLabelText('Estimacion')).toHaveValue(item.estimate);
    expect(screen.getByLabelText('Fecha limite')).toHaveValue('2026-03-15');
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Responsable')).not.toBeInTheDocument();
  });

  it('envia solo los campos modificados y vuelve al detalle actualizado', async () => {
    const item = itemDePrueba();
    const updatedItem = itemDePrueba({
      title: 'Detalle actualizado',
      updatedAt: '2026-02-03T11:30:00.000Z',
    });
    let payload: unknown;
    responderConItem(item);
    server.use(
      http.patch(UPDATE_URL, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({ item: updatedItem });
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="MEMBER" />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Titulo'));
    await user.type(screen.getByLabelText('Titulo'), updatedItem.title);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { name: updatedItem.title })).toBeInTheDocument();
    expect(payload).toEqual({ title: updatedItem.title });
  });

  it('Cancelar vuelve al detalle sin hacer PATCH', async () => {
    let patches = 0;
    responderConItem();
    server.use(
      http.patch(UPDATE_URL, () => {
        patches += 1;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="MEMBER" />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.type(screen.getByLabelText('Descripcion'), ' sin guardar');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      await screen.findByRole('heading', { name: 'Ver el detalle de un elemento' }),
    ).toBeInTheDocument();
    expect(patches).toBe(0);
  });

  it('no hace PATCH cuando no hay cambios reales', async () => {
    let patches = 0;
    responderConItem();
    server.use(
      http.patch(UPDATE_URL, () => {
        patches += 1;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="MEMBER" />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('No hay cambios para guardar.');
    expect(patches).toBe(0);
  });

  it('valida localmente antes de llamar a la API', async () => {
    let patches = 0;
    responderConItem();
    server.use(
      http.patch(UPDATE_URL, () => {
        patches += 1;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="MEMBER" />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Titulo'));
    await user.type(screen.getByLabelText('Titulo'), 'ab');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El titulo debe tener al menos 3 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Titulo')).toHaveAttribute('aria-invalid', 'true');
    expect(patches).toBe(0);
  });

  it.each([
    {
      name: '403',
      response: () => apiError(403, 'FORBIDDEN', 'No tienes permisos para editar este elemento'),
      message: 'No tienes permisos para editar este elemento',
    },
    {
      name: '500',
      response: () => apiError(500, 'INTERNAL_ERROR', 'No se pudo guardar el elemento'),
      message: 'No se pudo guardar el elemento',
    },
    {
      name: 'red',
      response: () => HttpResponse.error(),
      message: 'No se pudo conectar con el servidor. Revisa tu conexion.',
    },
  ])(
    'conserva el formulario y muestra el error $name al fallar el guardado',
    async ({ response, message }) => {
      responderConItem();
      server.use(http.patch(UPDATE_URL, response));
      const { user } = renderConProviders(
        <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="MEMBER" />,
      );

      await user.click(await screen.findByRole('button', { name: 'Editar' }));
      await user.clear(screen.getByLabelText('Titulo'));
      await user.type(screen.getByLabelText('Titulo'), 'Titulo que se conserva');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('heading', { name: 'Editar elemento' })).toBeInTheDocument();
      expect(screen.getByLabelText('Titulo')).toHaveValue('Titulo que se conserva');
    },
  );

  it('permite limpiar los campos nullable y envia null', async () => {
    const item = itemDePrueba();
    const updatedItem = itemDePrueba({ description: null, estimate: null, dueDate: null });
    let payload: unknown;
    responderConItem(item);
    server.use(
      http.patch(UPDATE_URL, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({ item: updatedItem });
      }),
    );
    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} role="OWNER" />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Descripcion'));
    await user.clear(screen.getByLabelText('Estimacion'));
    await user.clear(screen.getByLabelText('Fecha limite'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Sin descripción')).toBeInTheDocument();
    expect(screen.getByText('Sin estimar')).toBeInTheDocument();
    expect(screen.getByText('Sin fecha límite')).toBeInTheDocument();
    expect(payload).toEqual({ description: null, estimate: null, dueDate: null });
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
