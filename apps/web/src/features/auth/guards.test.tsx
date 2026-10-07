import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { AuthResponse } from '@mira/shared';
import { renderConProviders, screen } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { RequiereSesion, SoloInvitados } from './guards';

/**
 * Guardias de ruta.
 *
 * No se mockea useNavigate: la redireccion la hace <Navigate>, asi que se
 * monta un arbol minimo con rutas marcador y se verifica a donde se llego.
 */

const BASE_URL = 'http://localhost:3000/api';

function conSesion() {
  server.use(
    http.get(`${BASE_URL}/auth/me`, () =>
      HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA }),
    ),
  );
}

function Arbol() {
  return (
    <Routes>
      <Route
        path="/privada"
        element={
          <RequiereSesion>
            <p>Contenido privado</p>
          </RequiereSesion>
        }
      />
      <Route
        path="/login"
        element={
          <SoloInvitados>
            <p>Formulario de login</p>
          </SoloInvitados>
        }
      />
      <Route path="/proyectos" element={<p>Pagina de proyectos</p>} />
    </Routes>
  );
}

describe('RequiereSesion', () => {
  it('con sesion, muestra "Cargando..." y luego el contenido (sobrevive al recargo)', async () => {
    conSesion();
    renderConProviders(<Arbol />, { route: '/privada' });

    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i);
    expect(await screen.findByText('Contenido privado')).toBeInTheDocument();
  });

  it('sin sesion (401), redirige a /login', async () => {
    renderConProviders(<Arbol />, { route: '/privada' });

    expect(await screen.findByText('Formulario de login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument();
  });

  it('si /me falla con 500, ofrece reintentar sin redirigir, y reintentar recupera la sesion', async () => {
    server.use(http.get(`${BASE_URL}/auth/me`, () => apiError(500, 'INTERNAL', 'Error interno')));
    const { user } = renderConProviders(<Arbol />, { route: '/privada' });

    expect(await screen.findByText(/no se pudo verificar tu sesion/i)).toBeInTheDocument();
    expect(screen.queryByText('Formulario de login')).not.toBeInTheDocument();

    conSesion();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Contenido privado')).toBeInTheDocument();
  });
});

describe('SoloInvitados', () => {
  it('sin sesion, muestra el contenido de inmediato', () => {
    renderConProviders(<Arbol />, { route: '/login' });

    // Consulta sincrona a proposito: el invitado no espera a /me.
    expect(screen.getByText('Formulario de login')).toBeInTheDocument();
  });

  it('con sesion, redirige a /proyectos', async () => {
    conSesion();
    renderConProviders(<Arbol />, { route: '/login' });

    expect(await screen.findByText('Pagina de proyectos')).toBeInTheDocument();
    expect(screen.queryByText('Formulario de login')).not.toBeInTheDocument();
  });
});
