import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { CreateWorkItemInput, ProjectRole } from '@mira/shared';
import { ForbiddenError } from '../../lib/errors.js';
import type { CreatedWorkItem, WorkItemRepository, WorkItemUser } from './work-item.repository.js';
import { createWorkItemService, toWorkItemDto } from './work-item.service.js';

/**
 * NIVEL 1 de la piramide: unitario.
 *
 * El service recibe el repositorio por parametro, asi que estas pruebas usan
 * un doble en memoria. No hay PostgreSQL, Prisma real ni Express involucrados.
 */

const PROJECT_ID = 'project_1';
const ACTOR_ID = 'user_1';
const INPUT: CreateWorkItemInput = {
  title: 'Preparar la primera entrega',
  description: 'Implementar la base del producto.',
  type: 'STORY',
  status: 'TODO',
  priority: 'HIGH',
  estimate: 5,
  dueDate: new Date('2026-03-15T12:00:00.000Z'),
  // El service recibe el contrato ya validado; solo el repository decide que
  // MIR-11 no persiste este campo reservado para MIR-30.
  sprintId: 'sprint_reservado',
};

function usuarioDePrueba(overrides: Partial<WorkItemUser> = {}): WorkItemUser {
  return {
    id: 'user_1',
    name: 'Ada Lovelace',
    email: 'ada@mira.dev',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function itemDePrueba(overrides: Partial<CreatedWorkItem> = {}): CreatedWorkItem {
  return {
    id: 'item_1',
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: INPUT.title,
    description: INPUT.description ?? null,
    type: INPUT.type,
    status: INPUT.status,
    priority: INPUT.priority,
    estimate: INPUT.estimate ?? null,
    dueDate: INPUT.dueDate ?? null,
    assignee: null,
    createdBy: usuarioDePrueba(),
    sprintId: null,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:05:00.000Z'),
    ...overrides,
  };
}

describe('workItemService', () => {
  let repo: MockProxy<WorkItemRepository>;
  let service: ReturnType<typeof createWorkItemService>;

  beforeEach(() => {
    repo = mock<WorkItemRepository>();
    service = createWorkItemService(repo);
  });

  it.each(['OWNER', 'MEMBER'] as const)('%s puede crear un elemento de trabajo', async (role) => {
    repo.findMemberRole.mockResolvedValue(role);
    repo.createAtomically.mockResolvedValue(itemDePrueba());

    await expect(service.create(PROJECT_ID, ACTOR_ID, INPUT)).resolves.toMatchObject({
      id: 'item_1',
      reference: 'MIR-1',
    });
  });

  it.each([
    ['VIEWER', 'VIEWER' as ProjectRole],
    ['usuario que no pertenece al proyecto', null],
  ])('rechaza a %s con ForbiddenError sin crear nada', async (_caso, role) => {
    repo.findMemberRole.mockResolvedValue(role);

    await expect(service.create(PROJECT_ID, ACTOR_ID, INPUT)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    expect(repo.createAtomically).not.toHaveBeenCalled();
  });

  it('consulta la membresia usando el proyecto y actor correctos', async () => {
    repo.findMemberRole.mockResolvedValue('OWNER');
    repo.createAtomically.mockResolvedValue(itemDePrueba());

    await service.create(PROJECT_ID, ACTOR_ID, INPUT);

    expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
  });

  it('delega una unica creacion atomica con proyecto, actor e input correctos', async () => {
    repo.findMemberRole.mockResolvedValue('MEMBER');
    repo.createAtomically.mockResolvedValue(itemDePrueba());

    await service.create(PROJECT_ID, ACTOR_ID, INPUT);

    expect(repo.createAtomically).toHaveBeenCalledTimes(1);
    expect(repo.createAtomically).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      actorId: ACTOR_ID,
      input: INPUT,
    });
  });

  it('transforma el resultado a WorkItemDto y serializa las fechas como ISO', async () => {
    const createdBy = usuarioDePrueba({ createdAt: new Date('2026-01-02T03:04:05.000Z') });
    const assignee = usuarioDePrueba({
      id: 'user_2',
      name: 'Grace Hopper',
      email: 'grace@mira.dev',
      createdAt: new Date('2026-01-03T04:05:06.000Z'),
    });
    repo.findMemberRole.mockResolvedValue('OWNER');
    repo.createAtomically.mockResolvedValue(
      itemDePrueba({
        dueDate: new Date('2026-03-15T12:00:00.000Z'),
        createdBy,
        assignee,
      }),
    );

    const result = await service.create(PROJECT_ID, ACTOR_ID, INPUT);

    expect(result).toEqual({
      id: 'item_1',
      reference: 'MIR-1',
      projectId: PROJECT_ID,
      title: 'Preparar la primera entrega',
      description: 'Implementar la base del producto.',
      type: 'STORY',
      status: 'TODO',
      priority: 'HIGH',
      estimate: 5,
      dueDate: '2026-03-15T12:00:00.000Z',
      assignee: {
        id: 'user_2',
        name: 'Grace Hopper',
        email: 'grace@mira.dev',
        createdAt: '2026-01-03T04:05:06.000Z',
      },
      createdBy: {
        id: 'user_1',
        name: 'Ada Lovelace',
        email: 'ada@mira.dev',
        createdAt: '2026-01-02T03:04:05.000Z',
      },
      sprintId: null,
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:05:00.000Z',
    });
  });

  it('conserva assignee como null cuando el item no tiene responsable', async () => {
    repo.findMemberRole.mockResolvedValue('MEMBER');
    repo.createAtomically.mockResolvedValue(itemDePrueba({ assignee: null }));

    const result = await service.create(PROJECT_ID, ACTOR_ID, INPUT);

    expect(result.assignee).toBeNull();
  });

  it('propaga los errores del repository', async () => {
    const error = new Error('No se pudo completar la transaccion');
    repo.findMemberRole.mockResolvedValue('OWNER');
    repo.createAtomically.mockRejectedValue(error);

    await expect(service.create(PROJECT_ID, ACTOR_ID, INPUT)).rejects.toBe(error);
  });
});

describe('toWorkItemDto', () => {
  it('serializa fechas nullable y responsables ausentes', () => {
    const result = toWorkItemDto(itemDePrueba({ dueDate: null, assignee: null }));

    expect(result.dueDate).toBeNull();
    expect(result.assignee).toBeNull();
    expect(result.createdAt).toBe('2026-02-01T10:00:00.000Z');
  });
});
