import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError } from '@/test/msw/handlers';
import { InviteMemberForm } from './InviteMemberForm';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_1';
const ENDPOINT = `${BASE_URL}/projects/${PROJECT_ID}/members`;

const MEMBER_RESPONSE = {
  member: {
    id: 'member_1',
    userId: 'user_2',
    projectId: PROJECT_ID,
    role: 'MEMBER',
    joinedAt: '2026-10-07T00:00:00.000Z',
  },
};

describe('InviteMemberForm - MIR-9', () => {
  it('muestra el formulario para invitar miembros', () => {
    renderConProviders(<InviteMemberForm projectId={PROJECT_ID} />);

    expect(screen.getByRole('heading', { name: /invitar miembro/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /invitar miembro/i })).toBeInTheDocument();
  });

  it('permite invitar un usuario registrado y muestra exito (201)', async () => {
    let recibido: unknown;

    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        recibido = await request.json();

        return HttpResponse.json(MEMBER_RESPONSE, {
          status: 201,
        });
      }),
    );

    const { user } = renderConProviders(<InviteMemberForm projectId={PROJECT_ID} />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'nuevo@mira.dev');

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/miembro agregado correctamente/i);

    expect(recibido).toEqual({
      email: 'nuevo@mira.dev',
      role: 'MEMBER',
    });
  });

  it('muestra 404 cuando el usuario no existe', async () => {
    server.use(http.post(ENDPOINT, () => apiError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')));

    const { user } = renderConProviders(<InviteMemberForm projectId={PROJECT_ID} />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'inexistente@mira.dev');

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/usuario no encontrado/i);
  });

  it('muestra 409 cuando el usuario ya pertenece al proyecto', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        apiError(409, 'MEMBER_ALREADY_EXISTS', 'El usuario ya es miembro del proyecto'),
      ),
    );

    const { user } = renderConProviders(<InviteMemberForm projectId={PROJECT_ID} />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'alan@mira.dev');

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya es miembro del proyecto/i);
  });

  it('muestra 403 cuando un MEMBER intenta invitar', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        apiError(403, 'OWNER_REQUIRED', 'Solo el OWNER puede agregar miembros al proyecto'),
      ),
    );

    const { user } = renderConProviders(<InviteMemberForm projectId={PROJECT_ID} />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'nuevo@mira.dev');

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /solo el owner puede agregar miembros/i,
    );
  });

  it('rechaza correos invalidos sin llamar al backend', async () => {
    const llamadas = vi.fn();

    server.use(
      http.post(ENDPOINT, () => {
        llamadas();

        return HttpResponse.json(MEMBER_RESPONSE, {
          status: 201,
        });
      }),
    );

    const { user } = renderConProviders(<InviteMemberForm projectId={PROJECT_ID} />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'correo-invalido');

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/correo electronico/i)).toHaveAttribute('aria-invalid', 'true');
    });

    expect(llamadas).not.toHaveBeenCalled();
  });
});
