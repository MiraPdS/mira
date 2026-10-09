import {
  can,
  type ChangeStatusInput,
  type CreateWorkItemInput,
  type Paginated,
  type PublicUser,
  type UpdateWorkItemInput,
  type WorkItemActivityResponse,
  type WorkItemDto,
  type WorkItemFilters,
} from '@mira/shared';
import { toActivityDto } from '../../lib/activity.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type {
  WorkItemForDto,
  WorkItemRepository,
  WorkItemUpdateChange,
  WorkItemUser,
} from './work-item.repository.js';
export type { WorkItemUpdateChange } from './work-item.repository.js';

/** Convierte el subconjunto de usuario retornado por el repositorio al DTO publico. */
function toPublicUser(user: WorkItemUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Serializa el resultado de persistencia al contrato compartido de la API. */
export function toWorkItemDto(workItem: WorkItemForDto): WorkItemDto {
  return {
    id: workItem.id,
    reference: workItem.reference,
    projectId: workItem.projectId,
    title: workItem.title,
    description: workItem.description,
    type: workItem.type,
    status: workItem.status,
    priority: workItem.priority,
    estimate: workItem.estimate,
    dueDate: workItem.dueDate?.toISOString() ?? null,
    assignee: workItem.assignee ? toPublicUser(workItem.assignee) : null,
    createdBy: toPublicUser(workItem.createdBy),
    sprintId: workItem.sprintId,
    createdAt: workItem.createdAt.toISOString(),
    updatedAt: workItem.updatedAt.toISOString(),
  };
}

export const UPDATEABLE_WORK_ITEM_FIELDS = [
  'title',
  'description',
  'type',
  'priority',
  'estimate',
  'dueDate',
] as const satisfies readonly (keyof UpdateWorkItemInput)[];

export type UpdateableWorkItemField = (typeof UPDATEABLE_WORK_ITEM_FIELDS)[number];

/** DTO y actividades derivadas de una actualizacion. */
export interface PreparedWorkItemUpdate {
  item: WorkItemDto;
  changes: WorkItemUpdateChange[];
}

type UpdateableWorkItemValue = string | number | Date | null;

function valuesAreEqual(
  currentValue: UpdateableWorkItemValue,
  nextValue: UpdateableWorkItemValue,
): boolean {
  if (currentValue instanceof Date && nextValue instanceof Date) {
    return currentValue.getTime() === nextValue.getTime();
  }
  return currentValue === nextValue;
}

function toActivityValue(value: UpdateableWorkItemValue): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Aplica solo los campos presentes y prepara sus cambios para el historial.
 */
export function prepareWorkItemUpdate(
  workItem: WorkItemForDto,
  input: UpdateWorkItemInput,
): PreparedWorkItemUpdate {
  const updatedWorkItem = { ...workItem };
  const changes: WorkItemUpdateChange[] = [];

  for (const field of UPDATEABLE_WORK_ITEM_FIELDS) {
    const nextValue = input[field];
    if (nextValue === undefined) continue;

    const currentValue = workItem[field];
    if (valuesAreEqual(currentValue, nextValue)) continue;

    changes.push({
      field,
      fromValue: toActivityValue(currentValue),
      toValue: toActivityValue(nextValue),
    });
    Object.assign(updatedWorkItem, { [field]: nextValue });
  }

  return { item: toWorkItemDto(updatedWorkItem), changes };
}

/**
 * Reglas de negocio para elementos de trabajo.
 *
 * No conoce Express ni Prisma: recibe el repositorio por parametro, verifica
 * permisos con la matriz compartida y delega toda persistencia al repositorio.
 */
export function createWorkItemService(repo: WorkItemRepository) {
  return {
    async create(
      projectId: string,
      actorId: string,
      input: CreateWorkItemInput,
    ): Promise<WorkItemDto> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (!can(role, 'work-item:create')) throw new ForbiddenError();

      const workItem = await repo.createAtomically({ projectId, actorId, input });
      return toWorkItemDto(workItem);
    },

    async list(
      projectId: string,
      actorId: string,
      filters: WorkItemFilters,
    ): Promise<Paginated<WorkItemDto>> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const { items, total } = await repo.listByProject({ projectId, ...filters });

      return {
        data: items.map(toWorkItemDto),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
      };
    },

    async delete(projectId: string, actorId: string, workItemId: string): Promise<void> {
      const role = await repo.findMemberRole(projectId, actorId);
      // Misma politica de ocultacion que el detalle: el no miembro ve 404.
      if (role === null) throw new NotFoundError('Elemento de trabajo');
      if (!can(role, 'work-item:delete')) throw new ForbiddenError();

      const workItem = await repo.findByIdInProject(projectId, workItemId);
      if (!workItem) throw new NotFoundError('Elemento de trabajo');

      await repo.deleteAtomically({
        projectId,
        actorId,
        workItemId,
        reference: workItem.reference,
      });
    },

    async changeStatus(
      projectId: string,
      actorId: string,
      workItemId: string,
      input: ChangeStatusInput,
    ): Promise<WorkItemDto> {
      // Lectura y escritura en la misma transaccion serializable: un movimiento
      // concurrente obliga a reintentar con el estado vigente como fromValue.
      return repo.withTransaction(async (transactionRepo) => {
        const role = await transactionRepo.findMemberRole(projectId, actorId);
        // Misma politica de ocultacion que el detalle: el no miembro ve 404.
        if (role === null) throw new NotFoundError('Elemento de trabajo');
        if (!can(role, 'work-item:change-status')) throw new ForbiddenError();

        const workItem = await transactionRepo.findByIdInProject(projectId, workItemId);
        if (!workItem) throw new NotFoundError('Elemento de trabajo');

        // Mover al mismo estado no es un cambio: no se escribe ni se registra
        // historial, asi un doble envio no ensucia la trazabilidad.
        if (workItem.status === input.status) return toWorkItemDto(workItem);

        const updated = await transactionRepo.changeStatusAtomically({
          projectId,
          workItemId,
          actorId,
          fromStatus: workItem.status,
          toStatus: input.status,
        });
        return toWorkItemDto(updated);
      });
    },

    async getById(projectId: string, actorId: string, workItemId: string): Promise<WorkItemDto> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (role === null) throw new NotFoundError('Elemento de trabajo');
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const workItem = await repo.findByIdInProject(projectId, workItemId);
      if (!workItem) throw new NotFoundError('Elemento de trabajo');

      return toWorkItemDto(workItem);
    },

    /** MIR-22: historial del item, con la misma autorizacion que el detalle. */
    async activity(
      projectId: string,
      actorId: string,
      workItemId: string,
    ): Promise<WorkItemActivityResponse> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (role === null) throw new NotFoundError('Elemento de trabajo');
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const workItem = await repo.findByIdInProject(projectId, workItemId);
      if (!workItem) throw new NotFoundError('Elemento de trabajo');

      const { activities, truncated } = await repo.listActivity(projectId, workItemId);
      return { data: activities.map(toActivityDto), truncated };
    },

    async board(projectId: string, actorId: string): Promise<WorkItemDto[]> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const items = await repo.listBoardByProject(projectId);
      return items.map(toWorkItemDto);
    },

    async update(
      projectId: string,
      actorId: string,
      workItemId: string,
      input: UpdateWorkItemInput,
    ): Promise<PreparedWorkItemUpdate> {
      return repo.withTransaction(async (transactionRepo) => {
        const role = await transactionRepo.findMemberRole(projectId, actorId);
        if (role === null) throw new NotFoundError('Elemento de trabajo');
        if (!can(role, 'work-item:update')) throw new ForbiddenError();

        const workItem = await transactionRepo.findByIdInProject(projectId, workItemId);
        if (!workItem) throw new NotFoundError('Elemento de trabajo');

        const preparedUpdate = prepareWorkItemUpdate(workItem, input);
        if (preparedUpdate.changes.length === 0) return preparedUpdate;

        const updatedWorkItem = await transactionRepo.updateAtomically({
          projectId,
          workItemId,
          actorId,
          input,
          changes: preparedUpdate.changes,
        });

        return { item: toWorkItemDto(updatedWorkItem), changes: preparedUpdate.changes };
      });
    },
  };
}

export type WorkItemService = ReturnType<typeof createWorkItemService>;
