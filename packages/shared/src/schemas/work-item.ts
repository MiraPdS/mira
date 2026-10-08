import { z } from 'zod';
import {
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  ACTIVITY_ACTIONS,
} from '../domain.js';
import { publicUserSchema } from './auth.js';
import { paginationQuerySchema } from './common.js';

export const createWorkItemSchema = z.object({
  title: z.string().trim().min(3, 'El titulo debe tener al menos 3 caracteres').max(200),
  description: z.string().trim().max(10_000).optional(),
  type: z.enum(WORK_ITEM_TYPES).default('TASK'),
  priority: z.enum(WORK_ITEM_PRIORITIES).default('MEDIUM'),
  status: z.enum(WORK_ITEM_STATUSES).default('BACKLOG'),
  assigneeId: z.string().nullable().optional(),
  /** Estimacion en story points (escala Fibonacci acotada). */
  estimate: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  /** Reservado para E2, cuando existan Sprints. En E1 siempre va null. */
  sprintId: z.string().nullable().optional(),
});
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;

/**
 * Campos que pertenecen a MIR-15. Asignacion, estado y sprint tienen casos de
 * uso propios, por lo que no deben poder modificarse desde este contrato.
 */
export const updateWorkItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'El titulo debe tener al menos 3 caracteres')
      .max(200)
      .optional(),
    description: z
      .string()
      .trim()
      .max(10_000)
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
    type: z.enum(WORK_ITEM_TYPES).optional(),
    priority: z.enum(WORK_ITEM_PRIORITIES).optional(),
    /** Estimacion en story points (escala Fibonacci acotada). */
    estimate: z.number().int().min(0).max(100).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict();
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;

/** Endpoint dedicado para mover una tarjeta en el tablero. */
export const changeStatusSchema = z.object({
  status: z.enum(WORK_ITEM_STATUSES),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

/** Busqueda y filtros del backlog (requisito explicito del tema). */
export const workItemFiltersSchema = paginationQuerySchema.extend({
  /** Texto libre; busca en titulo y descripcion, sin distinguir mayusculas. */
  q: z.string().trim().max(200).optional(),
  type: z.enum(WORK_ITEM_TYPES).optional(),
  status: z.enum(WORK_ITEM_STATUSES).optional(),
  priority: z.enum(WORK_ITEM_PRIORITIES).optional(),
  assigneeId: z.string().optional(),
});
export type WorkItemFilters = z.infer<typeof workItemFiltersSchema>;

export const workItemSchema = z.object({
  id: z.string(),
  /** Identificador legible tipo MIR-12, generado por el backend. */
  reference: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.enum(WORK_ITEM_TYPES),
  status: z.enum(WORK_ITEM_STATUSES),
  priority: z.enum(WORK_ITEM_PRIORITIES),
  estimate: z.number().nullable(),
  dueDate: z.string().datetime().nullable(),
  assignee: publicUserSchema.nullable(),
  createdBy: publicUserSchema,
  sprintId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkItemDto = z.infer<typeof workItemSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'El comentario no puede estar vacio').max(5000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const commentSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: publicUserSchema,
  createdAt: z.string().datetime(),
});
export type CommentDto = z.infer<typeof commentSchema>;

export const activityEntrySchema = z.object({
  id: z.string(),
  action: z.enum(ACTIVITY_ACTIONS),
  actor: publicUserSchema,
  /** Campo modificado, cuando aplica (por ejemplo "status"). */
  field: z.string().nullable(),
  fromValue: z.string().nullable(),
  toValue: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ActivityEntryDto = z.infer<typeof activityEntrySchema>;
