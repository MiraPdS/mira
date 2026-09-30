/**
 * Vocabulario del dominio de Mira.
 *
 * Estos valores se declaran aqui (y NO se importan desde @prisma/client) para
 * que el frontend no tenga que depender del ORM.  El schema.prisma declara los
 * mismos enums; `domain.test.ts` no puede verificar esa sincronia, asi que la
 * regla del equipo es: si cambias un enum aqui, cambialo tambien en
 * apps/api/prisma/schema.prisma y genera la migracion en el mismo commit.
 */

export const PROJECT_ROLES = ['OWNER', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const WORK_ITEM_TYPES = ['EPIC', 'STORY', 'TASK', 'BUG'] as const;
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

/**
 * Columnas del tablero Kanban.  El orden del arreglo ES el orden de las
 * columnas en la UI.  En E1 es un enum fijo; convertirlo en columnas
 * configurables por proyecto esta reservado como requerimiento nuevo de E2.
 */
export const WORK_ITEM_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

/** Estados que se muestran como columnas del tablero (BACKLOG vive aparte). */
export const BOARD_STATUSES = WORK_ITEM_STATUSES.filter((s) => s !== 'BACKLOG');

export const WORK_ITEM_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];

export const ACTIVITY_ACTIONS = [
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_STATUS_CHANGED',
  'ITEM_ASSIGNED',
  'ITEM_DELETED',
  'COMMENT_ADDED',
  'MEMBER_ADDED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_REMOVED',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Etiquetas en espanol para la UI.  La UI nunca deberia hardcodear estos textos. */
export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revision',
  DONE: 'Hecho',
};

export const TYPE_LABELS: Record<WorkItemType, string> = {
  EPIC: 'Epica',
  STORY: 'Historia',
  TASK: 'Tarea',
  BUG: 'Bug',
};

export const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'Propietario',
  MEMBER: 'Miembro',
  VIEWER: 'Observador',
};
