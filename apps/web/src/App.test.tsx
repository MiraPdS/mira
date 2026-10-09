import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type {
  ApiError,
  AuthResponse,
  BoardResponse,
  ListProjectsResponse,
  ProjectDto,
} from '@mira/shared';
import { renderConProviders, screen } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, proyectoDePrueba, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { App } from './App';

/**
 * Mapeo de rutas de App.
 *
 * Las pruebas de cada pagina la renderizan directamente; aqui se verifica que
 * la URL lleve a esa pagina, para detectar una regresion en el arbol de rutas.
 */

const BASE_URL = 'http://localhost:3000/api';

/**
 * Simula la cookie de sesion: /me responde con el usuario mientras la sesion
 * este activa, y logout la desactiva, igual que el servidor al borrar la
 * cookie.
 */
function conCookieDeSesion() {
  let sesionActiva = true;
  server.use(
    http.get<never, never, AuthResponse | ApiError>(`${BASE_URL}/auth/me`, () => {
      if (!sesionActiva) return apiError(401, 'UNAUTHORIZED', 'Debes iniciar sesion');
      return HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA });
    }),
    http.post(`${BASE_URL}/auth/logout`, () => {
      sesionActiva = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

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
    conCookieDeSesion();
    server.use(
      http.get(`${BASE_URL}/projects/:projectId/board`, ({ params }) => {
        proyectoSolicitado = params.projectId as string;
        return HttpResponse.json<BoardResponse>({ items: [] });
      }),
    );

    renderConProviders(<App />, { route: '/proyectos/project_123/tablero' });

    expect(await screen.findByRole('heading', { name: 'Tablero' })).toBeInTheDocument();
    expect(proyectoSolicitado).toBe('project_123');
    expect(screen.getByRole('button', { name: /cerrar sesion/i })).toBeInTheDocument();
  });

  it('en /proyectos con sesion muestra la pantalla dentro del layout autenticado', async () => {
    conCookieDeSesion();
    renderConProviders(<App />, { route: '/proyectos' });

    expect(await screen.findByRole('heading', { name: /mis proyectos/i })).toBeInTheDocument();
    expect(screen.getByText(USUARIO_DE_PRUEBA.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesion/i })).toBeInTheDocument();
  });

  it('cerrar sesion lleva a /login y despues /proyectos ya no es accesible', async () => {
    conCookieDeSesion();
    const { user, queryClient, unmount } = renderConProviders(<App />, { route: '/proyectos' });

    await user.click(await screen.findByRole('button', { name: /cerrar sesion/i }));

    expect(await screen.findByRole('heading', { name: /iniciar sesion/i })).toBeInTheDocument();

    // Escribir /proyectos en la barra: mismo navegador, misma cache.
    unmount();
    renderConProviders(<App />, { route: '/proyectos', queryClient });

    expect(await screen.findByRole('heading', { name: /iniciar sesion/i })).toBeInTheDocument();
    expect(screen.queryByText(USUARIO_DE_PRUEBA.name)).not.toBeInTheDocument();
  });

  it('con sesion, /login redirige a /proyectos', async () => {
    conCookieDeSesion();
    renderConProviders(<App />, { route: '/login' });

    expect(await screen.findByRole('heading', { name: /mis proyectos/i })).toBeInTheDocument();
  });

  it('MIR-5: crear un proyecto desde la lista lo deja visible con rol Propietario', async () => {
    conCookieDeSesion();
    // Servidor en memoria: GET devuelve lo que se haya creado con POST.
    const proyectos: ProjectDto[] = [];
    server.use(
      http.get(`${BASE_URL}/projects`, () =>
        HttpResponse.json<ListProjectsResponse>({ projects: proyectos }),
      ),
      http.post(`${BASE_URL}/projects`, async ({ request }) => {
        const { name, key } = (await request.json()) as { name: string; key: string };
        const project = proyectoDePrueba({ id: 'p_nuevo', name, key, myRole: 'OWNER' });
        proyectos.push(project);
        return HttpResponse.json({ project }, { status: 201 });
      }),
    );
    const { user } = renderConProviders(<App />, { route: '/proyectos' });

    expect(await screen.findByText(/aun no participas en ningun proyecto/i)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Nuevo proyecto' }));

    await user.type(await screen.findByLabelText(/nombre/i), 'Plataforma Mira');
    await user.type(screen.getByLabelText(/clave/i), 'mir');
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    expect(await screen.findByRole('link', { name: 'Plataforma Mira' })).toHaveAttribute(
      'href',
      '/proyectos/p_nuevo',
    );
    expect(screen.getByRole('heading', { name: /mis proyectos/i })).toBeInTheDocument();
    expect(screen.getByText('MIR')).toBeInTheDocument();
    expect(screen.getByText('Propietario')).toBeInTheDocument();
  });
});
