import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import type * as ReactRouter from 'react-router-dom';
import type { AuthResponse } from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { authKeys } from './useAuth';
import { RegisterPage } from './RegisterPage';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library.
 *
 * Misma receta que LoginPage.test.tsx: pagina completa con proveedores
 * reales y MSW como unico doble. Un test por criterio de aceptacion de MIR-2
 * mas los casos de error del servidor (422, red caida).
 */

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const BASE_URL = 'http://localhost:3000/api';

const DATOS_VALIDOS = { name: 'Ada Lovelace', email: 'ada@mira.dev', password: 'abcd1234' };

function campos() {
  return {
    nombre: screen.getByLabelText(/nombre/i),
    correo: screen.getByLabelText(/correo electronico/i),
    contrasena: screen.getByLabelText(/contrasena/i),
  };
}

async function completarYEnviar(
  user: ReturnType<typeof renderConProviders>['user'],
  datos: { name: string; email: string; password: string } = DATOS_VALIDOS,
) {
  const { nombre, correo, contrasena } = campos();
  await user.type(nombre, datos.name);
  await user.type(correo, datos.email);
  await user.type(contrasena, datos.password);
  await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
}

describe('RegisterPage', () => {
  beforeEach(() => navigateMock.mockClear());

  it('muestra el formulario con sus campos accesibles y la ayuda de contrasena', () => {
    renderConProviders(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument();
    const { nombre, correo, contrasena } = campos();
    expect(nombre).toBeInTheDocument();
    expect(correo).toBeInTheDocument();
    expect(contrasena).toHaveAccessibleDescription(/minimo 8 caracteres/i);
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it('valida en el cliente y no llama a la API si el correo es invalido', async () => {
    const llamadas = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/register`, () => {
        llamadas();
        return HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA }, { status: 201 });
      }),
    );

    const { user } = renderConProviders(<RegisterPage />);
    await completarYEnviar(user, { ...DATOS_VALIDOS, email: 'no-es-un-correo' });

    expect(await screen.findByText(/correo electronico invalido/i)).toBeInTheDocument();
    expect(campos().correo).toHaveAttribute('aria-invalid', 'true');
    expect(llamadas).not.toHaveBeenCalled();
  });

  it('registra, deja la sesion iniciada y redirige a proyectos', async () => {
    let recibido: unknown;
    server.use(
      http.post(`${BASE_URL}/auth/register`, async ({ request }) => {
        recibido = await request.json();
        return HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA }, { status: 201 });
      }),
    );

    // El QueryClient de prueba usa gcTime: 0 y aqui nadie observa authKeys.me,
    // asi que lo que escribe setQueryData se recolectaria al instante. En la
    // app real lo observa RequiereSesion; aqui se conserva la cache a mano.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    const { user } = renderConProviders(<RegisterPage />, { queryClient });
    await completarYEnviar(user, { ...DATOS_VALIDOS, email: 'ADA@Mira.DEV' });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/proyectos', { replace: true });
    });
    expect(recibido).toEqual(DATOS_VALIDOS);
    expect(queryClient.getQueryData(authKeys.me)).toEqual(USUARIO_DE_PRUEBA);
  });

  it('si el correo ya existe, lo indica bajo el campo con enlace a login y conserva lo escrito', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/register`, () =>
        apiError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo'),
      ),
    );

    const { user } = renderConProviders(<RegisterPage />);
    await completarYEnviar(user);

    const alerta = await screen.findByText(/ya existe una cuenta con ese correo/i);
    expect(within(alerta).getByRole('link', { name: /inicia sesion/i })).toHaveAttribute(
      'href',
      '/login',
    );

    const { nombre, correo, contrasena } = campos();
    expect(correo).toHaveAttribute('aria-invalid', 'true');
    expect(correo).toHaveAccessibleDescription(/ya existe una cuenta/i);
    expect(nombre).toHaveValue(DATOS_VALIDOS.name);
    expect(correo).toHaveValue(DATOS_VALIDOS.email);
    expect(contrasena).toHaveValue(DATOS_VALIDOS.password);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('pinta bajo cada campo los errores 422 que devuelve el servidor', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/register`, () =>
        apiError(422, 'VALIDATION_ERROR', 'Datos invalidos', {
          password: ['La contrasena es demasiado comun'],
        }),
      ),
    );

    const { user } = renderConProviders(<RegisterPage />);
    await completarYEnviar(user);

    await waitFor(() => {
      expect(campos().contrasena).toHaveAccessibleDescription(/demasiado comun/i);
    });
    expect(campos().contrasena).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/datos invalidos/i)).not.toBeInTheDocument();
  });

  it('informa al usuario cuando la API no responde', async () => {
    server.use(http.post(`${BASE_URL}/auth/register`, () => HttpResponse.error()));

    const { user } = renderConProviders(<RegisterPage />);
    await completarYEnviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i);
    expect(campos().nombre).toHaveValue(DATOS_VALIDOS.name);
  });
});
