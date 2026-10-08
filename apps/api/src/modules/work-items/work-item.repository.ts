import type { PrismaClient } from '@prisma/client';
import type {
  CreateWorkItemInput,
  ProjectRole,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from '@mira/shared';
import { prisma, type Db } from '../../lib/prisma.js';

/** Datos de usuario que necesita la representacion publica de un item. */
export interface WorkItemUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

/** Item con las relaciones necesarias para construir su DTO publico. */
export interface WorkItemForDto {
  id: string;
  reference: string;
  projectId: string;
  title: string;
  description: string | null;
  type: WorkItemType;
  status: WorkItemStatus;
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
}

export interface DeleteWorkItemData {
  projectId: string;
  workItemId: string;
  actorId: string;
  reference: string;
}

export interface ListWorkItemsData {
  projectId: string;
  page: number;
  pageSize: number;
}

export interface ListWorkItemsResult {
  items: WorkItemForDto[];
  total: number;
}

/**
 * Puerto de persistencia del modulo de elementos de trabajo.
 *
 * El service depende de ESTA interfaz, no de Prisma. La creacion se expone
 * como una unica operacion para que reservar la referencia, crear el item y
 * registrar su actividad no puedan separarse.
 */
export interface WorkItemRepository {
  findMemberRole(projectId: string, userId: string): Promise<ProjectRole | null>;
  findByIdInProject(projectId: string, workItemId: string): Promise<WorkItemForDto | null>;
  createAtomically(data: CreateWorkItemData): Promise<WorkItemForDto>;
  deleteAtomically(data: DeleteWorkItemData): Promise<void>;
  listByProject(data: ListWorkItemsData): Promise<ListWorkItemsResult>;
}

const usersForDto = {
  select: {
    id: true,
    name: true,
    email: true,
    createdAt: true,
  },
} as const;

/** `Db` tambien puede representar una transaccion que ya fue abierta. */
function hasTransaction(db: Db): db is PrismaClient {
  return '$transaction' in db;
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
      status: data.input.status,
      priority: data.input.priority,
      estimate: data.input.estimate ?? null,
      dueDate: data.input.dueDate ?? null,
      // Los sprints estan reservados para MIR-30 / Entrega 2. MIR-11 no
      // persiste ningun sprint, aunque el contrato compartido ya lo declare.
      sprintId: null,
    },
    include: {
      assignee: usersForDto,
      createdBy: usersForDto,
    },
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

export function createWorkItemRepository(db: Db = prisma): WorkItemRepository {
  return {
    async findMemberRole(projectId, userId) {
      const member = await db.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { role: true },
      });
      return member?.role ?? null;
    },

    async findByIdInProject(projectId, workItemId) {
      return db.workItem.findFirst({
        where: { id: workItemId, projectId },
        include: {
          assignee: usersForDto,
          createdBy: usersForDto,
        },
      });
    },

    async createAtomically(data) {
      // Si se inyecta una transaccion, su caller ya controla el limite atomico.
      // En la aplicacion normal se inyecta PrismaClient y se abre la transaccion
      // que protege contador, item y actividad como una unidad indivisible.
      if (!hasTransaction(db)) return createInTransaction(db, data);
      return db.$transaction((tx) => createInTransaction(tx, data));
    },

    async deleteAtomically(data) {
      if (!hasTransaction(db)) return deleteInTransaction(db, data);
      return db.$transaction((tx) => deleteInTransaction(tx, data));
    },

    async listByProject({ projectId, page, pageSize }) {
      const skip = (page - 1) * pageSize;
      const where = { projectId };

      const [total, items] = await Promise.all([
        db.workItem.count({ where }),
        db.workItem.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            createdBy: usersForDto,
            assignee: usersForDto,
          },
        }),
      ]);

      return { items, total };
    },
  };
}
