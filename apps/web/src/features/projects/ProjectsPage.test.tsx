import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import type { ListProjectsResponse, ProjectDto } from '@mira/shared';
import { renderConProviders, screen, within } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, proyectoDePrueba } from '@/test/msw/handlers';
import { ProjectsPage } from './ProjectsPage';

/**
 * Pantalla "Mis proyectos" (MIR-6).
 *
 * Que un proyecto ajeno no aparezca (CA2) lo garantiza la API y se prueba en
 * projects.integration.test.ts; aqui se verifica que la pagina pinte lo que
 * recibe y sus estados de carga, error y vacio.
 */

const BASE_URL = 'http://localhost:3000/api';

function conProyectos(projects: ProjectDto[]) {
  server.use(
    http.get(`${BASE_URL}/projects`, () => HttpResponse.json<ListProjectsResponse>({ projects })),
  );
}

const ALFA = proyectoDePrueba({
  id: 'p_alfa',
  name: 'Alfa',
  key: 'ALF',
  description: 'Primer proyecto',
  myRole: 'OWNER',
});
const BETA = proyectoDePrueba({ id: 'p_beta', name: 'Beta', key: 'BET', myRole: 'VIEWER' });

describe('ProjectsPage', () => {
  it('CA1: muestra cada proyecto con su clave, su rol y un enlace a su pagina', async () => {
    conProyectos([ALFA, BETA]);
    renderConProviders(<ProjectsPage />, { route: '/proyectos' });

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);

    const alfa = within(items[0]!);
    expect(alfa.getByRole('link', { name: 'Alfa' })).toHaveAttribute('href', '/proyectos/p_alfa');
    expect(alfa.getByText('ALF')).toBeInTheDocument();
    expect(alfa.getByText('Propietario')).toBeInTheDocument();
    expect(alfa.getByText('Primer proyecto')).toBeInTheDocument();
    expect(alfa.getByRole('link', { name: 'Configuracion de Alfa' })).toHaveAttribute(
      'href',
      '/proyectos/p_alfa/configuracion',
    );

    const beta = within(items[1]!);
    expect(beta.getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/proyectos/p_beta');
    expect(beta.getByText('BET')).toBeInTheDocument();
    expect(beta.getByText('Observador')).toBeInTheDocument();
  });

  it('MIR-18: cada proyecto ofrece un acceso a su tablero, tambien para VIEWER', async () => {
    conProyectos([ALFA, BETA]);
    renderConProviders(<ProjectsPage />, { route: '/proyectos' });

    const items = await screen.findAllByRole('listitem');

    expect(within(items[0]!).getByRole('link', { name: 'Ver tablero de Alfa' })).toHaveAttribute(
      'href',
      '/proyectos/p_alfa/tablero',
    );
    expect(within(items[1]!).getByRole('link', { name: 'Ver tablero de Beta' })).toHaveAttribute(
      'href',
      '/proyectos/p_beta/tablero',
    );
  });

  it('CA3: sin proyectos, muestra un estado vacio que invita a crear el primero', async () => {
    renderConProviders(<ProjectsPage />, { route: '/proyectos' });

    expect(await screen.findByText(/aun no participas en ningun proyecto/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /crea tu primer proyecto/i })).toHaveAttribute(
      'href',
      '/proyectos/nuevo',
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('mientras carga, muestra "Cargando proyectos..."', async () => {
    server.use(
      http.get(`${BASE_URL}/projects`, async () => {
        await delay('infinite');
        return HttpResponse.json<ListProjectsResponse>({ projects: [] });
      }),
    );
    renderConProviders(<ProjectsPage />, { route: '/proyectos' });

    expect(screen.getByRole('status')).toHaveTextContent(/cargando proyectos/i);
  });

  it('si la API falla, ofrece reintentar y reintentar muestra la lista', async () => {
    server.use(http.get(`${BASE_URL}/projects`, () => apiError(500, 'INTERNAL', 'Error interno')));
    const { user } = renderConProviders(<ProjectsPage />, { route: '/proyectos' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudieron cargar tus proyectos/i,
    );

    conProyectos([ALFA]);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('link', { name: 'Alfa' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con proyectos, el encabezado ofrece crear uno nuevo', async () => {
    conProyectos([ALFA]);
    renderConProviders(<ProjectsPage />, { route: '/proyectos' });

    await screen.findAllByRole('listitem');
    expect(screen.getByRole('heading', { name: 'Mis proyectos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo proyecto' })).toHaveAttribute(
      'href',
      '/proyectos/nuevo',
    );
  });
});
