import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { AuthResponse, BoardResponse } from '@mira/shared';
import { renderConProviders, screen } from '@/test/render';
import { server } from '@/test/msw/server';
import { USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { App } from './App';

/**
 * Mapeo de rutas de App.
 *
 * Las pruebas de cada pagina la renderizan directamente; aqui se verifica que
 * la URL lleve a esa pagina, para detectar una regresion en el arbol de rutas.
 */
describe('App', () => {
  it('en /registro muestra el formulario de registro', () => {
    renderConProviders(<App />, { route: '/registro' });

    expect(screen.getByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contrasena/i)).toBeInTheDocument();
  });

  it('en /proyectos/:projectId/tablero muestra el tablero de ese proyecto', async () => {
    let proyectoSolicitado: string | undefined;
    server.use(
      http.get('http://localhost:3000/api/auth/me', () =>
        HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA }),
      ),
      http.get('http://localhost:3000/api/projects/:projectId/board', ({ params }) => {
        proyectoSolicitado = params.projectId as string;
        return HttpResponse.json<BoardResponse>({ items: [] });
      }),
    );

    renderConProviders(<App />, { route: '/proyectos/project_123/tablero' });

    expect(await screen.findByRole('heading', { name: 'Tablero' })).toBeInTheDocument();
    expect(proyectoSolicitado).toBe('project_123');
  });
});
