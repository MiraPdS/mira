import { beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import type * as ReactRouter from 'react-router-dom';
import type { CreateProjectInput, ProjectDto } from '@mira/shared';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, proyectoDePrueba } from '@/test/msw/handlers';
import { projectKeys } from './useProjects';
import { CreateProjectPage } from './CreateProjectPage';

/**
 * Pantalla "Nuevo proyecto" (MIR-5, parte web).
 *
 * Misma receta que RegisterPage.test.tsx: pagina completa con proveedores
 * reales, MSW como unico doble de red y useNavigate mockeado.
 */

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const BASE_URL = 'http://localhost:3000/api';

/** Responde 201 y guarda cada cuerpo recibido para inspeccionarlo. */
function capturarCreacion() {
  const cuerpos: CreateProjectInput[] = [];
  server.use(
    http.post(`${BASE_URL}/projects`, async ({ request }) => {
      const body = (await request.json()) as CreateProjectInput;
      cuerpos.push(body);
      return HttpResponse.json<{ project: ProjectDto }>(
        { project: proyectoDePrueba({ name: body.name, key: body.key }) },
        { status: 201 },
      );
    }),
  );
  return cuerpos;
}

function campos() {
  return {
    nombre: screen.getByLabelText(/nombre/i),
    clave: screen.getByLabelText(/clave/i),
    descripcion: screen.getByLabelText(/descripcion/i),
  };
}

async function completarYEnviar(
  user: ReturnType<typeof renderConProviders>['user'],
  datos: { name: string; key: string; description?: string } = { name: 'Mira', key: 'mir' },
) {
  const { nombre, clave, descripcion } = campos();
  await user.type(nombre, datos.name);
  await user.type(clave, datos.key);
  if (datos.description) await user.type(descripcion, datos.description);
  await user.click(screen.getByRole('button', { name: /crear proyecto/i }));
}

describe('CreateProjectPage', () => {
  beforeEach(() => navigateMock.mockClear());

  it('crea el proyecto con la clave en mayusculas, sin descripcion vacia, y vuelve a la lista', async () => {
    const cuerpos = capturarCreacion();
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/proyectos', { replace: true }));
    expect(cuerpos).toEqual([{ name: 'Mira', key: 'MIR' }]);
  });

  it('envia la descripcion sin espacios sobrantes', async () => {
    const cuerpos = capturarCreacion();
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user, {
      name: 'Mira',
      key: 'MIR',
      description: '  Tablero del equipo  ',
    });

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(cuerpos[0]).toEqual({ name: 'Mira', key: 'MIR', description: 'Tablero del equipo' });
  });

  it('invalida la lista de proyectos para que aparezca el nuevo', async () => {
    capturarCreacion();
    const { user, queryClient } = renderConProviders(<CreateProjectPage />);
    // Se espia en vez de sembrar la cache: el cliente de prueba usa gcTime 0 y
    // una query sin observadores se descarta antes de poder inspeccionarla.
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');

    await completarYEnviar(user);

    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: projectKeys.all }));
  });

  it('valida la clave en el cliente y no llama a la API si el formato es invalido', async () => {
    const cuerpos = capturarCreacion();
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user, { name: 'Mira', key: '1X' });

    expect(await screen.findByText(/debe empezar con letra/i)).toBeInTheDocument();
    expect(campos().clave).toHaveAttribute('aria-invalid', 'true');
    expect(cuerpos).toHaveLength(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('si la clave ya existe, lo indica bajo el campo, le da el foco y conserva lo escrito', async () => {
    server.use(
      http.post(`${BASE_URL}/projects`, () =>
        apiError(409, 'PROJECT_KEY_TAKEN', 'Ya existe un proyecto con la clave MIR'),
      ),
    );
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user);

    const { nombre, clave } = campos();
    expect(clave).toHaveAccessibleDescription(/ya existe un proyecto con la clave mir/i);
    expect(clave).toHaveFocus();
    expect(nombre).toHaveValue('Mira');
    expect(clave).toHaveValue('mir');
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('pinta bajo el campo los errores 422 que devuelve el servidor', async () => {
    server.use(
      http.post(`${BASE_URL}/projects`, () =>
        apiError(422, 'VALIDATION_ERROR', 'Datos invalidos', {
          name: ['El nombre no esta permitido'],
        }),
      ),
    );
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user);

    expect(await screen.findByText('El nombre no esta permitido')).toBeInTheDocument();
    expect(campos().nombre).toHaveAttribute('aria-invalid', 'true');
  });

  it('si la API falla sin campo, muestra el banner y conserva lo escrito', async () => {
    server.use(http.post(`${BASE_URL}/projects`, () => apiError(500, 'INTERNAL', 'Error interno')));
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
    expect(campos().nombre).toHaveValue('Mira');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('si la red falla, muestra el banner de conexion y conserva lo escrito', async () => {
    server.use(http.post(`${BASE_URL}/projects`, () => HttpResponse.error()));
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudo conectar con el servidor/i,
    );
    const { nombre, clave } = campos();
    expect(nombre).toHaveValue('Mira');
    expect(clave).toHaveValue('mir');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('deshabilita el boton mientras se crea', async () => {
    server.use(
      http.post(`${BASE_URL}/projects`, async () => {
        await delay('infinite');
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const { user } = renderConProviders(<CreateProjectPage />);

    await completarYEnviar(user);

    expect(await screen.findByRole('button', { name: /creando/i })).toBeDisabled();
  });

  it('ofrece cancelar y volver a la lista', () => {
    renderConProviders(<CreateProjectPage />);

    expect(screen.getByRole('link', { name: /cancelar/i })).toHaveAttribute('href', '/proyectos');
  });
});
