import { z } from 'zod';
import { ACTIVITY_ACTIONS } from '../domain.js';

/**
 * Una entrada de la bitacora, tal como la ven el panel del proyecto (MIR-23)
 * y el historial de un elemento (MIR-22).  Va estructurada a proposito: la
 * frase en lenguaje natural la arma el cliente.
 */
export const activitySchema = z.object({
  id: z.string(),
  action: z.enum(ACTIVITY_ACTIONS),
  workItemId: z.string().nullable(),
  actor: z.object({ id: z.string(), name: z.string() }),
  /** Campo modificado, cuando aplica (por ejemplo "status"). */
  field: z.string().nullable(),
  /**
   * Valores legibles: cuando el campo guarda un usuario (responsable o
   * miembro), el backend ya los entrega como nombre, nunca como id ("Usuario
   * eliminado" si ya no existe; null significa sin valor).
   */
  fromValue: z.string().nullable(),
  toValue: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ActivityDto = z.infer<typeof activitySchema>;

/** MIR-22: maximo de entradas que devuelve el historial de un elemento. */
export const ACTIVITY_LIST_LIMIT = 100;

/**
 * Respuesta de GET /api/projects/:projectId/work-items/:workItemId/activity.
 * `truncated` indica que hay mas de ACTIVITY_LIST_LIMIT entradas y solo se
 * entregan las mas recientes.
 */
export const workItemActivityResponseSchema = z.object({
  data: z.array(activitySchema),
  truncated: z.boolean(),
});
export type WorkItemActivityResponse = z.infer<typeof workItemActivityResponseSchema>;
