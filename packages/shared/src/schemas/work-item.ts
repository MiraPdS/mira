import { z } from 'zod';
import {
  COLUMN_CATEGORIES,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
} from '../domain.js';
import { publicUserSchema } from './auth.js';
import { paginationQuerySchema } from './common.js';

/**
 * MIR-31: columna del tablero de un proyecto. Se declara aqui y no en
 * project.ts porque la usa el contrato de los elementos de trabajo.
 */
export const boardColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Orden en el tablero, de izquierda a derecha. */
  position: z.number().int(),
  category: z.enum(COLUMN_CATEGORIES),
});
export type BoardColumnDto = z.infer<typeof boardColumnSchema>;

/** Columna de destino: `null` devuelve el elemento al backlog. */
const targetColumnIdSchema = z.string().trim().min(1, 'Indica la columna o null').nullable();

export const createWorkItemSchema = z.object({
  title: z.string().trim().min(3, 'El titulo debe tener al menos 3 caracteres').max(200),
  description: z.string().trim().max(10_000).optional(),
  type: z.enum(WORK_ITEM_TYPES).default('TASK'),
  priority: z.enum(WORK_ITEM_PRIORITIES).default('MEDIUM'),
  /**
   * Estado antiguo (puente MIR-31 -> MIR-49): se traduce a la columna por
   * defecto equivalente. Si viene `columnId`, este campo se ignora.
   */
  status: z.enum(WORK_ITEM_STATUSES).default('BACKLOG'),
  /** MIR-31: columna donde nace; `null` lo deja en el backlog. */
  columnId: targetColumnIdSchema.optional(),
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

/**
 * Endpoint dedicado para mover una tarjeta en el tablero (MIR-19).
 * Estricto: mover no es editar, asi que cualquier otro campo se rechaza.
 *
 * MIR-31: el destino es una columna del proyecto (`columnId`, o `null` para
 * el backlog). Mientras la web no use columnas (MIR-49) se sigue aceptando el
 * estado antiguo, que se traduce a su columna por defecto. Uno u otro, no
 * ambos.
 */
export const changeStatusSchema = z.union([
  z.object({ columnId: targetColumnIdSchema }).strict(),
  z.object({ status: z.enum(WORK_ITEM_STATUSES) }).strict(),
]);
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

/**
 * Asignar o quitar el responsable (MIR-17). Endpoint propio, como mover
 * (MIR-19): `null` deja el item sin asignar. Estricto: no se editan otros campos.
 */
export const assignWorkItemSchema = z
  .object({
    assigneeId: z.string().trim().min(1, 'Indica el responsable o null').nullable(),
  })
  .strict();
export type AssignWorkItemInput = z.infer<typeof assignWorkItemSchema>;

/** Busqueda y filtros del backlog (requisito explicito del tema). */
export const workItemFiltersSchema = paginationQuerySchema.extend({
  /** Texto libre; busca en titulo y descripcion, sin distinguir mayusculas. */
  q: z.string().trim().max(200).optional(),
  type: z.enum(WORK_ITEM_TYPES).optional(),
  status: z.enum(WORK_ITEM_STATUSES).optional(),
  /** MIR-31: elementos de una columna concreta del proyecto. */
  columnId: z.string().trim().min(1).optional(),
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
  /** Estado antiguo derivado de la columna (puente MIR-31; se quita en MIR-49). */
  status: z.enum(WORK_ITEM_STATUSES),
  /**
   * MIR-31: columna del elemento; `null` = backlog. Opcionales solo durante el
   * puente, para no tocar los datos de prueba de la web: la API los envia
   * siempre y MIR-49 los vuelve obligatorios.
   */
  columnId: z.string().nullable().optional(),
  column: boardColumnSchema.nullable().optional(),
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

/**
 * Respuesta del tablero Kanban: los items que estan en alguna columna, sin
 * paginar.  Va plana a proposito: el frontend recorre las columnas para
 * armarlas, asi una columna sin items existe igual.
 *
 * MIR-31: `columns` trae las columnas del proyecto en su orden. Opcional solo
 * durante el puente (la API la envia siempre); MIR-49 la usa en la web.
 */
export const boardResponseSchema = z.object({
  items: z.array(workItemSchema),
  columns: z.array(boardColumnSchema).optional(),
});
export type BoardResponse = z.infer<typeof boardResponseSchema>;

/** MIR-21: largo maximo de un comentario; lo usan la API y el formulario. */
export const COMMENT_MAX_LENGTH = 5000;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'El comentario no puede estar vacio').max(COMMENT_MAX_LENGTH),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const commentSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: publicUserSchema,
  createdAt: z.string().datetime(),
});
export type CommentDto = z.infer<typeof commentSchema>;
