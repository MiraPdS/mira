import { http, HttpResponse } from 'msw';
import type {
  ApiError,
  AuthResponse,
  CommentDto,
  ListProjectsResponse,
  ProjectDto,
  ProjectResponse,
  PublicUser,
} from '@mira/shared';

/**
 * Handlers por defecto de MSW.
 *
 * Representan el camino feliz. Un test que necesite un caso distinto
 * (credenciales malas, 500, red caida) sobrescribe SOLO ese endpoint con
 * `server.use(...)`, y el resto sigue funcionando.
 *
 * MSW intercepta a nivel de red, no de modulo: en los tests se ejecutan de
 * verdad el componente, react-hook-form, TanStack Query y api-client. Lo
 * unico falso es la respuesta del servidor.
 */

const BASE_URL = 'http://localhost:3000/api';

export const USUARIO_DE_PRUEBA: PublicUser = {
  id: 'user_1',
  name: 'Ada Lovelace',
  email: 'ada@mira.dev',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** ProjectDto valido para los tests; se ajusta con `overrides`. */
export function proyectoDePrueba(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: 'project_1',
    name: 'Mira',
    key: 'MIR',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    myRole: 'OWNER',
    ...overrides,
  };
}

/** Construye un error con la MISMA forma que produce el errorHandler de Express. */
export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  return HttpResponse.json<ApiError>(
    { error: { code, message, ...(fields && { fields }) } },
    { status },
  );
}

export const handlers = [
  http.post(`${BASE_URL}/auth/login`, () =>
    HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA }, { status: 200 }),
  ),

  http.post(`${BASE_URL}/auth/register`, () =>
    HttpResponse.json<AuthResponse>({ user: USUARIO_DE_PRUEBA }, { status: 201 }),
  ),

  http.post(`${BASE_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  // Por defecto NO hay sesion: los tests que necesiten un usuario autenticado
  // lo declaran explicitamente. Es mas seguro que asumir sesion iniciada.
  http.get(`${BASE_URL}/auth/me`, () => apiError(401, 'UNAUTHORIZED', 'Debes iniciar sesion')),

  // Usuario sin proyectos: el caso mas simple. Quien necesite una lista la
  // declara con server.use(...).
  http.get(`${BASE_URL}/projects`, () => HttpResponse.json<ListProjectsResponse>({ projects: [] })),

  // MIR-7: proyecto propio (OWNER). El PATCH devuelve el proyecto con los cambios.
  http.get(`${BASE_URL}/projects/:projectId`, ({ params }) =>
    HttpResponse.json<ProjectResponse>({
      project: proyectoDePrueba({ id: String(params.projectId) }),
    }),
  ),
  http.patch(`${BASE_URL}/projects/:projectId`, async ({ params, request }) => {
    const cambios = (await request.json()) as Partial<ProjectDto>;
    return HttpResponse.json<ProjectResponse>({
      project: proyectoDePrueba({ id: String(params.projectId), ...cambios }),
    });
  }),
  // MIR-21: elemento sin comentarios. Sin este handler la consulta falla y su
  // alerta se suma a las de la pantalla; quien necesite comentarios los
  // declara con server.use(...).
  http.get(`${BASE_URL}/projects/:projectId/work-items/:workItemId/comments`, () =>
    HttpResponse.json<{ comments: CommentDto[] }>({ comments: [] }),
  ),
];
