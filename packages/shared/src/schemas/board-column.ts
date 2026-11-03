import { z } from 'zod';
import { COLUMN_CATEGORIES } from '../domain.js';
import { boardColumnSchema } from './work-item.js';

/**
 * MIR-48: administrar las columnas del tablero. El DTO de una columna
 * (`boardColumnSchema`) vive en work-item.ts porque lo usa el contrato de los
 * elementos; aqui van solo los contratos de escritura.
 */

export const BOARD_COLUMN_NAME_MAX_LENGTH = 40;

const columnNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la columna no puede estar vacio')
  .max(BOARD_COLUMN_NAME_MAX_LENGTH);

/** Crear una columna: la posicion no se elige, siempre queda al final. */
export const createBoardColumnSchema = z
  .object({
    name: columnNameSchema,
    category: z.enum(COLUMN_CATEGORIES),
  })
  .strict();
export type CreateBoardColumnInput = z.infer<typeof createBoardColumnSchema>;

/**
 * Renombrar o cambiar la categoria. La posicion se cambia con el endpoint de
 * orden, que reescribe todas a la vez; por eso `.strict()` la rechaza (422).
 */
export const updateBoardColumnSchema = createBoardColumnSchema
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debes enviar al menos un campo',
  });
export type UpdateBoardColumnInput = z.infer<typeof updateBoardColumnSchema>;

/**
 * Nuevo orden del tablero: TODAS las columnas del proyecto, de izquierda a
 * derecha. Mandar la lista completa (y no "mover X a la posicion N") hace que
 * el resultado no dependa del orden en que lleguen dos peticiones.
 */
export const reorderBoardColumnsSchema = z
  .object({
    columnIds: z
      .array(z.string().trim().min(1))
      .min(1, 'Indica el orden de las columnas')
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Una columna no puede aparecer dos veces',
      }),
  })
  .strict();
export type ReorderBoardColumnsInput = z.infer<typeof reorderBoardColumnsSchema>;

/**
 * DELETE /columns/:columnId?moveTo=<columnId>. Va en la query porque un DELETE
 * con cuerpo no siempre sobrevive a proxies y clientes HTTP. Solo es
 * obligatorio si la columna tiene elementos.
 */
export const deleteBoardColumnQuerySchema = z.object({
  moveTo: z.string().trim().min(1, 'Indica la columna de destino').optional(),
});
export type DeleteBoardColumnQuery = z.infer<typeof deleteBoardColumnQuerySchema>;

export const boardColumnResponseSchema = z.object({ column: boardColumnSchema });
export type BoardColumnResponse = z.infer<typeof boardColumnResponseSchema>;

export const boardColumnListResponseSchema = z.object({ columns: z.array(boardColumnSchema) });
export type BoardColumnListResponse = z.infer<typeof boardColumnListResponseSchema>;
