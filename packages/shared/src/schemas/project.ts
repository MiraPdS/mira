import { z } from 'zod';
import {
  PROJECT_ROLES,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
} from '../domain.js';
import { activitySchema, type ActivityDto } from './activity.js';
import { emailSchema, publicUserSchema } from './auth.js';

/** Clave corta del proyecto: prefijo de las tarjetas, estilo MIR-12. */
export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'La clave debe tener al menos 2 caracteres')
  .max(8, 'La clave no puede superar los 8 caracteres')
  .regex(/^[A-Z][A-Z0-9]*$/, 'La clave debe empezar con letra y usar solo letras y numeros');

/**
 * Descripcion opcional. `null` o un texto que queda vacio tras el trim se
 * guardan como `null`: asi "sin descripcion" tiene una sola forma en la base.
 */
const descriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .transform((value) => (value === '' ? null : value));

export const createProjectSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  key: projectKeySchema,
  description: descriptionSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * PATCH parcial de nombre y descripcion. La clave es inmutable: al no estar en
 * el `pick`, `.strict()` la rechaza (422) igual que a cualquier campo
 * desconocido. Un cuerpo vacio tambien es 422.
 */
export const updateProjectSchema = createProjectSchema
  .pick({ name: true, description: true })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debes enviar al menos un campo',
  });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(PROJECT_ROLES).default('MEMBER'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const changeMemberRoleSchema = z.object({
  role: z.enum(['MEMBER', 'VIEWER']),
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

export const projectMemberSchema = z.object({
  id: z.string(),
  role: z.enum(PROJECT_ROLES),
  user: publicUserSchema,
  joinedAt: z.string().datetime(),
});
export type ProjectMemberDto = z.infer<typeof projectMemberSchema>;

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Rol del usuario autenticado en ESTE proyecto. Alimenta can() en el front. */
  myRole: z.enum(PROJECT_ROLES),
});
export type ProjectDto = z.infer<typeof projectSchema>;

/** Respuesta de GET /api/projects: los proyectos donde el usuario es miembro. */
export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

/** Respuesta de crear, ver y editar un proyecto. */
export const projectResponseSchema = z.object({
  project: projectSchema,
});
export type ProjectResponse = z.infer<typeof projectResponseSchema>;

/**
 * Conteo por cada valor de un enum. Se arma como objeto (y no con z.record)
 * para que el tipo exija TODAS las claves: un proyecto vacio responde ceros,
 * no claves ausentes.
 */
function conteoPor<const T extends readonly [string, ...string[]]>(valores: T) {
  return z.object(
    Object.fromEntries(valores.map((valor) => [valor, z.number().int().nonnegative()])) as {
      [K in T[number]]: z.ZodNumber;
    },
  );
}

/** MIR-23: una entrada de la actividad reciente del proyecto. */
export const projectActivitySchema = activitySchema;
export type ProjectActivityDto = ActivityDto;

/** MIR-23: resumen del proyecto (conteos y actividad reciente). */
export const projectSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  byStatus: conteoPor(WORK_ITEM_STATUSES),
  byType: conteoPor(WORK_ITEM_TYPES),
  byPriority: conteoPor(WORK_ITEM_PRIORITIES),
  recentActivity: z.array(projectActivitySchema),
});
export type ProjectSummaryDto = z.infer<typeof projectSummarySchema>;

/** Respuesta de GET /api/projects/:projectId/summary. */
export const projectSummaryResponseSchema = z.object({
  summary: projectSummarySchema,
});
export type ProjectSummaryResponse = z.infer<typeof projectSummaryResponseSchema>;
