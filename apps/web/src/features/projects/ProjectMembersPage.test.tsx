import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { ProjectMembersPage } from './ProjectMembersPage';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_1';
const ENDPOINT = `${BASE_URL}/projects/${PROJECT_ID}/members`;

const owner = {
  id: 'member_1',
  userId: 'user_1',
  projectId: PROJECT_ID,
  role: 'OWNER',
  joinedAt: '2026-10-07T00:00:00.000Z',
  user: {
    id: 'user_1',
    name: 'Ada Lovelace',
    email: 'ada@mira.dev',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const nuevoMiembro = {
  id: 'member_2',
  userId: 'user_2',
  projectId: PROJECT_ID,
  role: 'MEMBER',
  joinedAt: '2026-10-07T00:00:00.000Z',
  user: {
    id: 'user_2',
    name: 'Nuevo Usuario',
    email: 'nuevo@mira.dev',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/miembros" element={<ProjectMembersPage />} />
    </Routes>,
    {
      route: `/proyectos/${PROJECT_ID}/miembros`,
    },
  );
}

describe('ProjectMembersPage - MIR-9', () => {
  it('actualiza la lista despues de invitar un miembro', async () => {
    let miembros = [owner];
    let consultas = 0;

    server.use(
      http.get(`${BASE_URL}/auth/me`, () => {
        return HttpResponse.json({
          user: owner.user,
        });
      }),

      http.get(ENDPOINT, () => {
        consultas++;

        return HttpResponse.json({
          members: miembros,
        });
      }),

      http.post(ENDPOINT, () => {
        miembros = [...miembros, nuevoMiembro];

        return HttpResponse.json({ member: nuevoMiembro }, { status: 201 });
      }),
    );

    const { user } = renderPagina();

    // Inicialmente aparece el OWNER.
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();

    // El nuevo usuario todavia no aparece.
    expect(screen.queryByText('Nuevo Usuario')).not.toBeInTheDocument();

    // Invitamos al nuevo usuario.
    await user.type(screen.getByLabelText(/correo electronico/i), 'nuevo@mira.dev');

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    // El formulario informa que la invitacion fue exitosa.
    expect(await screen.findByText(/miembro agregado correctamente/i)).toBeInTheDocument();

    // TanStack Query vuelve a consultar la lista.
    expect(await screen.findByText('Nuevo Usuario')).toBeInTheDocument();

    expect(screen.getByText('nuevo@mira.dev')).toBeInTheDocument();

    await waitFor(() => {
      expect(consultas).toBeGreaterThanOrEqual(2);
    });
  });

  it.each(['MEMBER', 'VIEWER'] as const)(
    'no muestra el formulario para un usuario con rol %s',
    async (role) => {
      const integrante = {
        ...owner,
        id: 'member_3',
        userId: 'user_3',
        role,
        user: {
          ...owner.user,
          id: 'user_3',
          name: 'Usuario de prueba',
          email: 'usuario@mira.dev',
        },
      };

      server.use(
        http.get(`${BASE_URL}/auth/me`, () => {
          return HttpResponse.json({
            user: integrante.user,
          });
        }),

        http.get(ENDPOINT, () => {
          return HttpResponse.json({
            members: [owner, integrante],
          });
        }),
      );

      renderPagina();

      // MEMBER y VIEWER pueden consultar los integrantes.
      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();

      expect(screen.getByText('Usuario de prueba')).toBeInTheDocument();

      // Esperamos a que termine la consulta del usuario actual.
      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /cargando/i })).not.toBeInTheDocument();
      });

      // No pueden ver el formulario de invitacion.
      expect(screen.queryByRole('button', { name: /invitar miembro/i })).not.toBeInTheDocument();

      expect(screen.queryByLabelText(/correo electronico/i)).not.toBeInTheDocument();
    },
  );
});
