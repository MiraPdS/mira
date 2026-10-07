import { can, type CreateWorkItemInput, type PublicUser, type WorkItemDto } from '@mira/shared';
import { ForbiddenError } from '../../lib/errors.js';
import type { CreatedWorkItem, WorkItemRepository, WorkItemUser } from './work-item.repository.js';

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
export function toWorkItemDto(workItem: CreatedWorkItem): WorkItemDto {
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
  };
}

export type WorkItemService = ReturnType<typeof createWorkItemService>;
