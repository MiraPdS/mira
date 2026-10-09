import type { ActivityLog } from '@prisma/client';
import type { ActivityDto } from '@mira/shared';
import type { Db } from './prisma.js';

/** Una fila de la bitacora con el nombre de quien la hizo. */
export type ActivityWithActor = ActivityLog & {
  actor: { id: string; name: string };
};

/** Lo que piden las consultas de bitacora para conocer al actor. */
export const activityActorInclude = { actor: { select: { id: true, name: true } } } as const;

/**
 * Campos de la bitacora que guardan el id de un usuario. La UI los muestra con
 * el nombre.
 */
const USER_ID_FIELDS = new Set(['assigneeId', 'member']);

/** Nombre que se muestra cuando el usuario guardado en la bitacora ya no existe. */
export const DELETED_USER_NAME = 'Usuario eliminado';

/**
 * Traduce a nombres los ids de usuario guardados en la bitacora, en UNA
 * consulta, para que la UI nunca muestre un id crudo.  Lo usan el panel del
 * proyecto (MIR-23) y el historial de un elemento (MIR-22).
 */
export async function resolveActivityUserNames<T extends ActivityLog>(
  db: Db,
  activities: T[],
): Promise<T[]> {
  const userIds = new Set<string>();
  for (const activity of activities) {
    if (activity.field && USER_ID_FIELDS.has(activity.field)) {
      if (activity.fromValue) userIds.add(activity.fromValue);
      if (activity.toValue) userIds.add(activity.toValue);
    }
  }
  if (userIds.size === 0) return activities;

  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((user) => [user.id, user.name]));
  // null sigue significando "sin valor" (p. ej. sin responsable); un id cuyo
  // usuario ya no existe no debe leerse como si se hubiera desasignado.
  const toName = (value: string | null) =>
    value ? (nameById.get(value) ?? DELETED_USER_NAME) : null;

  return activities.map((activity) =>
    activity.field && USER_ID_FIELDS.has(activity.field)
      ? { ...activity, fromValue: toName(activity.fromValue), toValue: toName(activity.toValue) }
      : activity,
  );
}

/** Serializa una fila de la bitacora al contrato compartido. */
export function toActivityDto(activity: ActivityWithActor): ActivityDto {
  return {
    id: activity.id,
    action: activity.action,
    workItemId: activity.workItemId,
    actor: activity.actor,
    field: activity.field,
    fromValue: activity.fromValue,
    toValue: activity.toValue,
    createdAt: activity.createdAt.toISOString(),
  };
}
