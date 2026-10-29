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
 * MIR-31: categoria de una columna del tablero. Las columnas son por proyecto
 * y se pueden llamar como el equipo quiera; la categoria es lo que permite que
 * el panel (MIR-23) y el cierre de sprint (MIR-46) sepan que esta terminado.
 */
export const COLUMN_CATEGORIES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

/**
 * Categorias con las que cuenta el panel: las de las columnas mas BACKLOG,
 * que agrupa a los elementos que no estan en ninguna columna.
 */
export const ITEM_CATEGORIES = ['BACKLOG', ...COLUMN_CATEGORIES] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/**
 * Columnas con las que nace todo proyecto (y las que la migracion de MIR-31
 * creo en los proyectos existentes), en su orden.
 */
export const DEFAULT_BOARD_COLUMNS = [
  { name: 'Por hacer', category: 'TODO' },
  { name: 'En progreso', category: 'IN_PROGRESS' },
  { name: 'En revision', category: 'IN_PROGRESS' },
  { name: 'Hecho', category: 'DONE' },
] as const satisfies ReadonlyArray<{ name: string; category: ColumnCategory }>;

/**
 * MIR-49: un elemento sin columna esta en el backlog. Este valor lo nombra
 * donde hace falta un texto: el filtro `columnId=BACKLOG` del backlog y los
 * `fromValue`/`toValue` de ITEM_STATUS_CHANGED (que guardan el nombre de la
 * columna, o este valor si no habia).
 */
export const BACKLOG = 'BACKLOG' as const;

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
  'PROJECT_UPDATED',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/**
 * Etiquetas en espanol para la UI.  La UI nunca deberia hardcodear estos textos.
 *
 * MIR-31: categorias de columna (y BACKLOG, para el panel y el backlog). Los
 * estados ya no tienen etiqueta fija: son las columnas de cada proyecto.
 */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Por hacer',
  IN_PROGRESS: 'En curso',
  DONE: 'Terminado',
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
