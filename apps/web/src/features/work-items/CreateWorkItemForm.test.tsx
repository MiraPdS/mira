import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { WorkItemDto } from '@mira/shared';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { CreateWorkItemForm } from './CreateWorkItemForm';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library + MSW.
 *
 * Se ejecutan el formulario, zodResolver, TanStack Query, useCreateWorkItem
 * y api-client reales. MSW es el unico limite falso: representa la API HTTP.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const CREATE_URL = `${BASE_URL}/projects/${PROJECT_ID}/work-items`;

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_7',
    reference: 'MIR-7',
    projectId: PROJECT_ID,
    title: 'Implementar login',
    description: 'Formulario de acceso.',
    type: 'TASK',
    status: 'BACKLOG',
    priority: 'MEDIUM',
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

function responderConItem(item: WorkItemDto = itemDePrueba()) {
  server.use(http.post(CREATE_URL, () => HttpResponse.json({ item }, { status: 201 })));
}

async function completarTitulo(
  user: ReturnType<typeof renderConProviders>['user'],
  title = 'Titulo valido',
) {
  await user.type(screen.getByLabelText('Titulo'), title);
}

describe('CreateWorkItemForm', () => {
  it('muestra los campos accesibles y el boton de creacion', () => {
    renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);

    expect(screen.getByLabelText('Titulo')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripcion')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Prioridad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear elemento/i })).toBeInTheDocument();
  });

  it('muestra TASK y MEDIUM como defaults visibles', () => {
    renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);

    expect(screen.getByLabelText('Tipo')).toHaveValue('TASK');
    expect(screen.getByLabelText('Tipo')).toHaveDisplayValue('Tarea');
    expect(screen.getByLabelText('Prioridad')).toHaveValue('MEDIUM');
    expect(screen.getByLabelText('Prioridad')).toHaveDisplayValue('Media');
  });

  it('valida el titulo en cliente y no llama a la API cuando es demasiado corto', async () => {
    const llamadas = vi.fn();
    server.use(
      http.post(CREATE_URL, () => {
        llamadas();
        return HttpResponse.json({ item: itemDePrueba() }, { status: 201 });
      }),
    );

    const { user } = renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);
    await completarTitulo(user, 'No');
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    expect(await screen.findByText(/titulo debe tener al menos 3 caracteres/i)).toBeInTheDocument();
    expect(llamadas).not.toHaveBeenCalled();
  });

  it('envia el path y payload correctos, incluidos los defaults no visibles', async () => {
    let received: unknown;
    responderConItem();
    server.use(
      http.post(CREATE_URL, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { item: itemDePrueba({ type: 'STORY', priority: 'HIGH' }) },
          { status: 201 },
        );
      }),
    );

    const { user } = renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);
    await completarTitulo(user, 'Crear historia de usuario');
    await user.type(screen.getByLabelText('Descripcion'), 'Como usuario quiero iniciar sesion.');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'STORY');
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'HIGH');
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    await screen.findByRole('status');
    expect(received).toEqual({
      title: 'Crear historia de usuario',
      description: 'Como usuario quiero iniciar sesion.',
      type: 'STORY',
      priority: 'HIGH',
      status: 'BACKLOG',
    });
  });

  it('muestra la referencia creada y notifica al contenedor', async () => {
    const item = itemDePrueba();
    const onCreated = vi.fn();
    responderConItem(item);

    const { user } = renderConProviders(
      <CreateWorkItemForm projectId={PROJECT_ID} onCreated={onCreated} />,
    );
    await completarTitulo(user, item.title);
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Elemento MIR-7 creado correctamente.',
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(item);
  });

  it('restablece los campos a sus defaults despues de crear', async () => {
    responderConItem(itemDePrueba({ type: 'STORY', priority: 'HIGH' }));

    const { user } = renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);
    await completarTitulo(user, 'Elemento para resetear');
    await user.type(screen.getByLabelText('Descripcion'), 'Descripcion temporal');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'STORY');
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'HIGH');
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    await screen.findByRole('status');
    expect(screen.getByLabelText('Titulo')).toHaveValue('');
    expect(screen.getByLabelText('Descripcion')).toHaveValue('');
    expect(screen.getByLabelText('Tipo')).toHaveValue('TASK');
    expect(screen.getByLabelText('Prioridad')).toHaveValue('MEDIUM');
  });

  it('muestra el rechazo 403 sin confirmar ni notificar creacion', async () => {
    const onCreated = vi.fn();
    server.use(
      http.post(CREATE_URL, () =>
        apiError(403, 'FORBIDDEN', 'No tienes permisos para realizar esta accion'),
      ),
    );

    const { user } = renderConProviders(
      <CreateWorkItemForm projectId={PROJECT_ID} onCreated={onCreated} />,
    );
    await completarTitulo(user);
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permisos/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('asocia el error 422 de title al campo titulo', async () => {
    server.use(
      http.post(CREATE_URL, () =>
        apiError(422, 'VALIDATION_ERROR', 'Datos invalidos', {
          title: ['El titulo fue rechazado por el servidor'],
        }),
      ),
    );

    const { user } = renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);
    await completarTitulo(user);
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    expect(await screen.findByText('El titulo fue rechazado por el servidor')).toBeInTheDocument();
    expect(screen.getByLabelText('Titulo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Titulo')).toHaveAttribute('aria-describedby', 'title-error');
  });

  it('muestra un error accesible cuando falla la red', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.error()));

    const { user } = renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);
    await completarTitulo(user);
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i);
  });

  it('deshabilita el submit mientras la creacion esta pendiente', async () => {
    let releaseResponse!: () => void;
    const responsePending = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const llamadas = vi.fn();
    server.use(
      http.post(CREATE_URL, async () => {
        llamadas();
        await responsePending;
        return HttpResponse.json({ item: itemDePrueba() }, { status: 201 });
      }),
    );

    const { user } = renderConProviders(<CreateWorkItemForm projectId={PROJECT_ID} />);
    await completarTitulo(user);
    await user.click(screen.getByRole('button', { name: /crear elemento/i }));

    const button = await screen.findByRole('button', { name: 'Creando...' });
    expect(button).toBeDisabled();
    await waitFor(() => expect(llamadas).toHaveBeenCalledTimes(1));

    releaseResponse();
    await screen.findByRole('status');
    expect(llamadas).toHaveBeenCalledTimes(1);
  });
});
