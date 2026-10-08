import { z } from 'zod';
import { PROJECT_ROLES } from '../domain.js';
import { emailSchema, publicUserSchema } from './auth.js';

/** Clave corta del proyecto: prefijo de las tarjetas, estilo MIR-12. */
export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'La clave debe tener al menos 2 caracteres')
  .max(8, 'La clave no puede superar los 8 caracteres')
  .regex(/^[A-Z][A-Z0-9]*$/, 'La clave debe empezar con letra y usar solo letras y numeros');

export const createProjectSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  key: projectKeySchema,
  description: z.string().trim().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** Todo opcional: PATCH parcial. `.strict()` rechaza campos desconocidos. */
export const updateProjectSchema = createProjectSchema.partial().strict();
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
