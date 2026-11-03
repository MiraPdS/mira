import { z } from 'zod';
import { SPRINT_STATUSES } from '../domain.js';

/** Fecha de calendario valida, sin hora ni conversion implicita desde null. */
const calendarDateSchema = z.string().date('Indica una fecha valida en formato YYYY-MM-DD');

const sprintFieldsSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  goal: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .optional(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
});

/** El orden lexicografico coincide con el cronologico en fechas YYYY-MM-DD. */
function validateDateRange(
  input: { startDate?: string; endDate?: string },
  context: z.RefinementCtx,
) {
  if (
    input.startDate !== undefined &&
    input.endDate !== undefined &&
    input.endDate < input.startDate
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'La fecha de termino no puede ser anterior a la fecha de inicio',
    });
  }
}

/** El cliente no puede elegir el estado inicial ni el proyecto en el body. */
export const createSprintSchema = sprintFieldsSchema.strict().superRefine(validateDateRange);
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

/**
 * PATCH parcial. Si llega una sola fecha, el service debe combinarla
 * con la persistida y validar el intervalo completo antes de escribir.
 */
export const updateSprintSchema = sprintFieldsSchema
  .partial()
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Debes enviar al menos un campo',
  })
  .superRefine(validateDateRange);
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

/** MIR-46: el destino afecta exclusivamente a los elementos no terminados. */
export const closeSprintSchema = z
  .object({
    moveUnfinishedToSprintId: z.string().trim().min(1).nullable(),
  })
  .strict();
export type CloseSprintInput = z.infer<typeof closeSprintSchema>;

const sprintDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  goal: z.string().nullable(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  status: z.enum(SPRINT_STATUSES),
  committedPoints: z.number().int().nonnegative().nullable(),
  completedPoints: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sprintSchema = sprintDtoSchema.superRefine(validateDateRange);
export type SprintDto = z.infer<typeof sprintSchema>;

/** Metricas calculadas: cantidad de items y suma de sus estimaciones. */
export const sprintListItemSchema = sprintDtoSchema
  .extend({
    items: z.number().int().nonnegative(),
    points: z.number().finite().nonnegative(),
  })
  .superRefine(validateDateRange);
export type SprintListItemDto = z.infer<typeof sprintListItemSchema>;

/** Respuestas HTTP de MIR-43, compartidas con el cliente web (MIR-44). */
export interface SprintResponse {
  sprint: SprintDto;
}
export interface SprintListResponse {
  data: SprintListItemDto[];
}
