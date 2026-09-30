import { z } from 'zod';

/** Forma unica de todo error de la API. El cliente puede confiar en esta forma. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Errores por campo, presente solo cuando falla la validacion (HTTP 422). */
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const cuidSchema = z.string().min(1, 'identificador requerido');
