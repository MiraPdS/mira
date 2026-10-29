import { Prisma } from '@prisma/client';
import {
  ACTIVITY_LIST_LIMIT,
  COLUMN_CATEGORIES,
  type ColumnCategory,
  type CreateWorkItemInput,
  type ProjectRole,
  type UpdateWorkItemInput,
  type WorkItemFilters,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
} from '@mira/shared';
import {
  activityActorInclude,
  resolveActivityUserNames,
  type ActivityWithActor,
} from '../../lib/activity.js';
import { findMemberRole, hasTransaction, prisma, type Db } from '../../lib/prisma.js';

/** Datos de usuario que necesita la representacion publica de un item. */
export interface WorkItemUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

/**
 * MIR-31: columna tal como la necesitan el DTO y las reglas de movimiento.
 * `legacyStatus` es el puente hacia el `status` antiguo (se va en MIR-49).
 */
export interface BoardColumnRecord {
  id: string;
  name: string;
  position: number;
  category: ColumnCategory;
  legacyStatus: WorkItemStatus | null;
}

/** Item con las relaciones necesarias para construir su DTO publico. */
export interface WorkItemForDto {
  id: string;
  reference: string;
  projectId: string;
  title: string;
  description: string | null;
  type: WorkItemType;
  /** MIR-31: null = BACKLOG. */
  columnId: string | null;
  column: BoardColumnRecord | null;
  priority: WorkItemPriority;
  estimate: number | null;
  dueDate: Date | null;
  assignee: WorkItemUser | null;
  createdBy: WorkItemUser;
  sprintId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkItemData {
  projectId: string;
  actorId: string;
  input: CreateWorkItemInput;
  /** MIR-31: columna ya resuelta por el service; null = backlog. */
  columnId: string | null;
}

export type UpdateableWorkItemField = keyof UpdateWorkItemInput;

/** Representacion persistible de una actividad ITEM_UPDATED. */
export interface WorkItemUpdateChange {
  field: UpdateableWorkItemField;
  fromValue: string | null;
  toValue: string | null;
}

export interface UpdateWorkItemData {
  projectId: string;
  workItemId: string;
  actorId: string;
  input: UpdateWorkItemInput;
  changes: WorkItemUpdateChange[];
}

export interface DeleteWorkItemData {
  projectId: string;
  workItemId: string;
  actorId: string;
  reference: string;
}

/** MIR-31: mover entre columnas; null = backlog. */
export interface ChangeStatusData {
  projectId: string;
  workItemId: string;
  actorId: string;
  fromColumn: BoardColumnRecord | null;
  toColumn: BoardColumnRecord | null;
}

/** MIR-17: cambio de responsable; null significa sin asignar. */
export interface AssignData {
  projectId: string;
  workItemId: string;
  actorId: string;
  fromAssigneeId: string | null;
  toAssigneeId: string | null;
}

export interface ListWorkItemsData extends Pick<
  WorkItemFilters,
  'q' | 'type' | 'status' | 'columnId' | 'priority' | 'assigneeId'
> {
  projectId: string;
  page: number;
  pageSize: number;
}

export interface ListWorkItemsResult {
  items: WorkItemForDto[];
  total: number;
}

/** MIR-22: entradas mas recientes del historial de un item. */
export interface WorkItemActivityResult {
  activities: ActivityWithActor[];
  /** Hay mas entradas que `limit`; solo se devuelven las mas recientes. */
  truncated: boolean;
}

/**
 * Puerto de persistencia del modulo de elementos de trabajo.
 *
 * El service depende de ESTA interfaz, no de Prisma. La creacion se expone
 * como una unica operacion para que reservar la referencia, crear el item y
 * registrar su actividad no puedan separarse.
 */
export interface WorkItemRepository {
  withTransaction<T>(operation: (repo: WorkItemRepository) => Promise<T>): Promise<T>;
  findMemberRole(projectId: string, userId: string): Promise<ProjectRole | null>;
  findByIdInProject(projectId: string, workItemId: string): Promise<WorkItemForDto | null>;
  createAtomically(data: CreateWorkItemData): Promise<WorkItemForDto>;
  updateAtomically(data: UpdateWorkItemData): Promise<WorkItemForDto>;
  deleteAtomically(data: DeleteWorkItemData): Promise<void>;
  /** Cambia la columna y registra ITEM_STATUS_CHANGED como una sola unidad. */
  changeStatusAtomically(data: ChangeStatusData): Promise<WorkItemForDto>;
  /** MIR-31: columnas del proyecto, en el orden del tablero. */
  listColumns(projectId: string): Promise<BoardColumnRecord[]>;
  /** MIR-31: una columna, solo si pertenece al proyecto. */
  findColumnInProject(projectId: string, columnId: string): Promise<BoardColumnRecord | null>;
  /** MIR-31 (puente): la columna por defecto que equivale a un estado antiguo. */
  findColumnByLegacyStatus(
    projectId: string,
    status: Exclude<WorkItemStatus, 'BACKLOG'>,
  ): Promise<BoardColumnRecord | null>;
  /** MIR-17: cambia el responsable y registra ITEM_ASSIGNED como una sola unidad. */
  assignAtomically(data: AssignData): Promise<WorkItemForDto>;
  listByProject(data: ListWorkItemsData): Promise<ListWorkItemsResult>;
  /** Items que estan en alguna columna (todo menos BACKLOG), sin paginar. */
  listBoardByProject(projectId: string): Promise<WorkItemForDto[]>;
  /** MIR-22: historial del item, del mas reciente al mas antiguo. */
  listActivity(
    projectId: string,
    workItemId: string,
    limit?: number,
  ): Promise<WorkItemActivityResult>;
}

const usersForDto = {
  select: {
    id: true,
    name: true,
    email: true,
    createdAt: true,
  },
} as const;

const columnForDto = {
  select: {
    id: true,
    name: true,
    position: true,
    category: true,
    legacyStatus: true,
  },
} as const;

/** Relaciones que necesita toWorkItemDto, en todas las lecturas y escrituras. */
const includeForDto = {
  assignee: usersForDto,
  createdBy: usersForDto,
  column: columnForDto,
} as const;

/**
 * MIR-31 (puente): filtro por estado antiguo. Coincide con legacyStatusOf:
 * BACKLOG es no tener columna; un estado es su columna por defecto o, si es
 * tambien una categoria, cualquier columna nueva de esa categoria.
 */
function whereForLegacyStatus(status: WorkItemStatus): Prisma.WorkItemWhereInput {
  if (status === 'BACKLOG') return { columnId: null };

  const isCategory = (COLUMN_CATEGORIES as readonly string[]).includes(status);
  return {
    column: isCategory
      ? {
          OR: [
            { legacyStatus: status },
            { legacyStatus: null, category: status as ColumnCategory },
          ],
        }
      : { legacyStatus: status },
  };
}

/** Construye filtros Prisma que se aplican identicamente al count y al listado. */
export function workItemWhereForList({
  projectId,
  q,
  type,
  status,
  columnId,
  priority,
  assigneeId,
}: ListWorkItemsData): Prisma.WorkItemWhereInput {
  return {
    projectId,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(type ? { type } : {}),
    // En AND y no esparcido: el estado BACKLOG tambien habla de columnId y
    // no debe pisar el filtro por columna (juntos no devuelven nada).
    ...(status ? { AND: [whereForLegacyStatus(status)] } : {}),
    ...(columnId ? { columnId } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assigneeId } : {}),
  };
}

async function createInTransaction(db: Db, data: CreateWorkItemData): Promise<WorkItemForDto> {
  // update con increment reserva el siguiente numero en la misma sentencia.
  // Postgres bloquea la fila del proyecto hasta terminar la transaccion, por
  // lo que dos creaciones concurrentes nunca reciben el mismo contador.
  const project = await db.project.update({
    where: { id: data.projectId },
    data: { itemCounter: { increment: 1 } },
    select: { key: true, itemCounter: true },
  });

  const workItem = await db.workItem.create({
    data: {
      reference: `${project.key}-${project.itemCounter}`,
      projectId: data.projectId,
      createdById: data.actorId,
      // La asignacion de responsables pertenece a MIR-17. Aunque el contrato
      // de creacion ya conoce assigneeId, MIR-11 siempre deja el item sin uno.
      assigneeId: null,
      title: data.input.title,
      description: data.input.description ?? null,
      type: data.input.type,
      columnId: data.columnId,
      priority: data.input.priority,
      estimate: data.input.estimate ?? null,
      dueDate: data.input.dueDate ?? null,
      // Los sprints estan reservados para MIR-30 / Entrega 2. MIR-11 no
      // persiste ningun sprint, aunque el contrato compartido ya lo declare.
      sprintId: null,
    },
    include: includeForDto,
  });

  await db.activityLog.create({
    data: {
      action: 'ITEM_CREATED',
      projectId: data.projectId,
      workItemId: workItem.id,
      actorId: data.actorId,
    },
  });

  return workItem;
}

async function updateInTransaction(db: Db, data: UpdateWorkItemData): Promise<WorkItemForDto> {
  const workItem = await db.workItem.update({
    where: { id: data.workItemId, projectId: data.projectId },
    data: data.input,
    include: includeForDto,
  });

  if (data.changes.length > 0) {
    await db.activityLog.createMany({
      data: data.changes.map((change) => ({
        action: 'ITEM_UPDATED',
        projectId: data.projectId,
        workItemId: data.workItemId,
        actorId: data.actorId,
        field: change.field,
        fromValue: change.fromValue,
        toValue: change.toValue,
      })),
    });
  }

  return workItem;
}

async function deleteInTransaction(db: Db, data: DeleteWorkItemData): Promise<void> {
  // Se registra mientras el item existe; al borrarlo, la FK SetNull conserva
  // tanto este evento como el historial previo, con su referencia legible.
  await db.activityLog.create({
    data: {
      action: 'ITEM_DELETED',
      projectId: data.projectId,
      actorId: data.actorId,
      workItemId: data.workItemId,
      field: 'reference',
      fromValue: data.reference,
      toValue: null,
    },
  });
  await db.workItem.delete({ where: { id: data.workItemId, projectId: data.projectId } });
}

/**
 * MIR-31: como queda una columna en la bitacora. Las columnas por defecto
 * guardan su estado antiguo (TODO, DONE...), igual que antes de MIR-31, asi el
 * historial ya escrito y el nuevo se leen igual en la web. Una columna sin
 * estado antiguo (MIR-48) guarda su nombre del momento: si despues se renombra
 * o se elimina, el historial sigue diciendo donde estuvo. MIR-49 revisa esto
 * al sacar el puente.
 */
export function activityValueOfColumn(column: BoardColumnRecord | null): string {
  if (column === null) return 'BACKLOG';
  return column.legacyStatus ?? column.name;
}

async function changeStatusInTransaction(db: Db, data: ChangeStatusData): Promise<WorkItemForDto> {
  const workItem = await db.workItem.update({
    where: { id: data.workItemId, projectId: data.projectId },
    data: { columnId: data.toColumn?.id ?? null },
    include: includeForDto,
  });

  await db.activityLog.create({
    data: {
      action: 'ITEM_STATUS_CHANGED',
      projectId: data.projectId,
      workItemId: data.workItemId,
      actorId: data.actorId,
      field: 'status',
      fromValue: activityValueOfColumn(data.fromColumn),
      toValue: activityValueOfColumn(data.toColumn),
    },
  });

  return workItem;
}

async function assignInTransaction(db: Db, data: AssignData): Promise<WorkItemForDto> {
  const workItem = await db.workItem.update({
    where: { id: data.workItemId, projectId: data.projectId },
    data: { assigneeId: data.toAssigneeId },
    include: includeForDto,
  });

  // Se guardan ids de usuario: el panel del proyecto (MIR-23) los traduce a
  // nombres al mostrar la actividad.
  await db.activityLog.create({
    data: {
      action: 'ITEM_ASSIGNED',
      projectId: data.projectId,
      workItemId: data.workItemId,
      actorId: data.actorId,
      field: 'assigneeId',
      fromValue: data.fromAssigneeId,
      toValue: data.toAssigneeId,
    },
  });

  return workItem;
}

export function createWorkItemRepository(db: Db = prisma): WorkItemRepository {
  return {
    async withTransaction(operation) {
      if (!hasTransaction(db)) return operation(createWorkItemRepository(db));
      // Un PATCH concurrente debe recalcular cambios sobre la versión vigente,
      // no guardar un fromValue obsoleto leído antes de otra actualización.
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await db.$transaction((tx) => operation(createWorkItemRepository(tx)), {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
        } catch (error) {
          if (
            attempt >= 2 ||
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2034'
          )
            throw error;
        }
      }
    },

    findMemberRole: (projectId, userId) => findMemberRole(db, projectId, userId),

    async findByIdInProject(projectId, workItemId) {
      return db.workItem.findFirst({
        where: { id: workItemId, projectId },
        include: includeForDto,
      });
    },

    async createAtomically(data) {
      // Si se inyecta una transaccion, su caller ya controla el limite atomico.
      // En la aplicacion normal se inyecta PrismaClient y se abre la transaccion
      // que protege contador, item y actividad como una unidad indivisible.
      if (!hasTransaction(db)) return createInTransaction(db, data);
      return db.$transaction((tx) => createInTransaction(tx, data));
    },

    async updateAtomically(data) {
      // Item y entradas ITEM_UPDATED son inseparables: si una actividad no se
      // puede escribir, la actualizacion del item tambien se revierte.
      if (!hasTransaction(db)) return updateInTransaction(db, data);
      return db.$transaction((tx) => updateInTransaction(tx, data));
    },

    async deleteAtomically(data) {
      if (!hasTransaction(db)) return deleteInTransaction(db, data);
      return db.$transaction((tx) => deleteInTransaction(tx, data));
    },

    async changeStatusAtomically(data) {
      if (!hasTransaction(db)) return changeStatusInTransaction(db, data);
      return db.$transaction((tx) => changeStatusInTransaction(tx, data));
    },

    async assignAtomically(data) {
      if (!hasTransaction(db)) return assignInTransaction(db, data);
      return db.$transaction((tx) => assignInTransaction(tx, data));
    },

    async listByProject(data) {
      const { page, pageSize } = data;
      const skip = (page - 1) * pageSize;
      const where = workItemWhereForList(data);

      const [total, items] = await Promise.all([
        db.workItem.count({ where }),
        db.workItem.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: includeForDto,
        }),
      ]);

      return { items, total };
    },

    async listColumns(projectId) {
      return db.boardColumn.findMany({
        where: { projectId },
        // El id desempata si dos columnas quedaran con la misma posicion.
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        ...columnForDto,
      });
    },

    async findColumnInProject(projectId, columnId) {
      return db.boardColumn.findFirst({ where: { id: columnId, projectId }, ...columnForDto });
    },

    async findColumnByLegacyStatus(projectId, status) {
      return db.boardColumn.findUnique({
        where: { projectId_legacyStatus: { projectId, legacyStatus: status } },
        ...columnForDto,
      });
    },

    async listBoardByProject(projectId) {
      return db.workItem.findMany({
        // Usa el indice (projectId, columnId) del esquema.
        where: { projectId, columnId: { not: null } },
        // position queda listo para el reordenamiento de MIR-20; mientras
        // tanto todos valen 0 y desempatan la creacion y el id.
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeForDto,
      });
    },

    async listActivity(projectId, workItemId, limit = ACTIVITY_LIST_LIMIT) {
      const rows = await db.activityLog.findMany({
        // Usa el indice (workItemId, createdAt) del esquema.
        where: { projectId, workItemId },
        // El id desempata las filas ITEM_UPDATED de un mismo PATCH, que
        // comparten timestamp.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        // Una fila de mas basta para saber si el historial se corto.
        take: limit + 1,
        include: activityActorInclude,
      });

      return {
        activities: await resolveActivityUserNames(db, rows.slice(0, limit)),
        truncated: rows.length > limit,
      };
    },
  };
}
