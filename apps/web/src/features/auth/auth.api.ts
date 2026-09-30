import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@mira/shared';
import { api } from '@/lib/api-client';

/**
 * Llamadas HTTP del modulo auth.
 *
 * Los tipos vienen de @mira/shared, es decir del MISMO esquema Zod que Express
 * usa para validar: si el contrato cambia, esto deja de compilar.
 */
export const authApi = {
  register: (input: RegisterInput) => api.post<AuthResponse>('/auth/register', input),
  login: (input: LoginInput) => api.post<AuthResponse>('/auth/login', input),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<AuthResponse>('/auth/me'),
};

export type { PublicUser };
