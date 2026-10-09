import type { ApiError } from '@mira/shared';

/**
 * Cliente HTTP unico del frontend.
 *
 * Dos decisiones que se repiten en cada peticion y por eso viven aqui:
 *
 *  credentials: 'include'  -> sin esto el navegador NO envia la cookie de
 *                             sesion a otro origen (en local :5173 -> :3000),
 *                             y todo responderia 401. Desplegado es mismo
 *                             origen via el rewrite /api de Vercel (D13).
 *  ApiRequestError          -> todo error de la API llega con la misma forma
 *                             ({ error: { code, message, fields } }), asi que
 *                             la UI tiene un solo camino para mostrarlos.
 *
 * Los tests NO mockean este modulo: MSW intercepta a nivel de red, de modo
 * que este codigo se ejecuta de verdad en los tests de componentes.
 */

// En el build de produccion el valor por defecto es '/api' (rewrite de
// Vercel, D13): si falta VITE_API_URL, el bundle no debe apuntar al
// localhost de cada visitante. `||` y no `??`: una variable definida pero
// vacia en el dashboard tambien debe caer al valor por defecto.
const BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** Primer mensaje de error de un campo puntual, para pintarlo en el formulario. */
  fieldError(name: string): string | undefined {
    return this.fields?.[name]?.[0];
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch solo rechaza por fallo de red, no por status 4xx/5xx.
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor. Revisa tu conexion.',
    );
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as ApiError | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Ocurrio un error inesperado',
      error?.fields,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
