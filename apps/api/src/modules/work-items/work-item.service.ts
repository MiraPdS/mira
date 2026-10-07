import {
  can,
  type CreateWorkItemInput,
  type Paginated,
  type PaginationQuery,
  type PublicUser,
  type WorkItemDto,
} from '@mira/shared';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { WorkItemForDto, WorkItemRepository, WorkItemUser } from './work-item.repository.js';

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
      pagination: PaginationQuery,
    ): Promise<Paginated<WorkItemDto>> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const { items, total } = await repo.listByProject({ projectId, ...pagination });

      return {
        data: items.map(toWorkItemDto),
        ...pagination,
        total,
      };
    },

    async getById(projectId: string, actorId: string, workItemId: string): Promise<WorkItemDto> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (role === null) throw new NotFoundError('Elemento de trabajo');
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const workItem = await repo.findByIdInProject(projectId, workItemId);
      if (!workItem) throw new NotFoundError('Elemento de trabajo');

      return toWorkItemDto(workItem);
    },

    async board(projectId: string, actorId: string): Promise<WorkItemDto[]> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const items = await repo.listBoardByProject(projectId);
      return items.map(toWorkItemDto);
    },
  };
}

export type WorkItemService = ReturnType<typeof createWorkItemService>;
