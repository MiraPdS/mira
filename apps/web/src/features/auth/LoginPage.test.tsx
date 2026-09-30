import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type * as ReactRouter from 'react-router-dom';
import type { AuthResponse } from '@mira/shared';
import { renderConProviders, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { LoginPage } from './LoginPage';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library.
 *
 * Se renderiza la pagina COMPLETA con sus proveedores reales (router y
 * TanStack Query) y MSW falsea solo la respuesta HTTP. Es decir: el
 * formulario, la validacion con zodResolver, el hook useLogin y api-client se
 * ejecutan de verdad.
 *
 * Todas las consultas son accesibles (getByLabelText, getByRole): si un dia
 * el <label htmlFor> se rompe, estos tests lo detectan, porque un formulario
 * que el test no encuentra tampoco lo encuentra un lector de pantalla.
 */

// react-router: se intercepta useNavigate para poder afirmar la redireccion
// sin montar el arbol de rutas completo de la aplicacion.
// vi.hoisted es necesario: las llamadas a vi.mock se elevan por encima de
// las declaraciones, asi que un `const` normal estaria sin inicializar
// cuando la factory se ejecuta.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const BASE_URL = 'http://localhost:3000/api';

describe('LoginPage', () => {
  beforeEach(() => navigateMock.mockClear());

  it('muestra el formulario con sus campos accesibles', () => {
    renderConProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: /iniciar sesion/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contrasena/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('valida en el cliente y no llama a la API si el correo es invalido', async () => {
    // Si el componente llamara a la API, MSW esta en modo 'error' para
    // peticiones no declaradas, pero aqui ademas lo verificamos explicitamente.
    const llamadas = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/login`, () => {
        llamadas();
        return HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA });
      }),
    );

    const { user } = renderConProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'no-es-un-correo');
    await user.type(screen.getByLabelText(/contrasena/i), 'abcd1234');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText(/correo electronico invalido/i)).toBeInTheDocument();
    expect(llamadas).not.toHaveBeenCalled();
  });

  it('marca el campo invalido con aria-invalid', async () => {
    const { user } = renderConProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/correo electronico/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('envia las credenciales y redirige a proyectos cuando el login es exitoso', async () => {
    let recibido: unknown;
    server.use(
      http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
        recibido = await request.json();
        return HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA });
      }),
    );

    const { user } = renderConProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'ada@mira.dev');
    await user.type(screen.getByLabelText(/contrasena/i), 'abcd1234');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/proyectos', { replace: true });
    });
    expect(recibido).toEqual({ email: 'ada@mira.dev', password: 'abcd1234' });
  });

  it('normaliza el correo a minusculas antes de enviarlo', async () => {
    // Lo hace el esquema Zod compartido, el mismo que corre en el servidor.
    let recibido: { email?: string } = {};
    server.use(
      http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
        recibido = (await request.json()) as { email?: string };
        return HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA });
      }),
    );

    const { user } = renderConProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'ADA@Mira.DEV');
    await user.type(screen.getByLabelText(/contrasena/i), 'abcd1234');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => expect(recibido.email).toBe('ada@mira.dev'));
  });

  it('muestra el mensaje del servidor cuando las credenciales son incorrectas', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/login`, () =>
        apiError(401, 'INVALID_CREDENTIALS', 'Correo o contrasena incorrectos'),
      ),
    );

    const { user } = renderConProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'ada@mira.dev');
    await user.type(screen.getByLabelText(/contrasena/i), 'incorrecta1');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/correo o contrasena incorrectos/i);
    expect(navigateMock).not.toHaveBeenCalledWith('/proyectos', { replace: true });
  });

  it('informa al usuario cuando la API no responde', async () => {
    server.use(http.post(`${BASE_URL}/auth/login`, () => HttpResponse.error()));

    const { user } = renderConProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/correo electronico/i), 'ada@mira.dev');
    await user.type(screen.getByLabelText(/contrasena/i), 'abcd1234');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i);
  });
});
