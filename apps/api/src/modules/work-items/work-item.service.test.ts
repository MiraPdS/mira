import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type {
  CreateWorkItemInput,
  PaginationQuery,
  ProjectRole,
  WorkItemFilters,
} from '@mira/shared';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type {
  ListWorkItemsResult,
  WorkItemForDto,
  WorkItemRepository,
  WorkItemUser,
} from './work-item.repository.js';
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

const PAGINATION: PaginationQuery = {
  page: 2,
  pageSize: 20,
};

const FILTERS: WorkItemFilters = {
  page: 3,
  pageSize: 10,
  q: 'login',
  type: 'BUG',
  status: 'TODO',
  priority: 'HIGH',
  assigneeId: 'user_2',
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

function itemDePrueba(overrides: Partial<WorkItemForDto> = {}): WorkItemForDto {
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

  describe('list', () => {
    it.each(['OWNER', 'MEMBER', 'VIEWER'] as const)(
      '%s puede listar elementos de trabajo',
      async (role) => {
        const item = itemDePrueba();
        repo.findMemberRole.mockResolvedValue(role);
        repo.listByProject.mockResolvedValue({ items: [item], total: 1 });

        const result = await service.list(PROJECT_ID, ACTOR_ID, PAGINATION);

        expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
        expect(repo.listByProject).toHaveBeenCalledWith({
          projectId: PROJECT_ID,
          ...PAGINATION,
        });
        expect(result).toEqual({
          data: [toWorkItemDto(item)],
          ...PAGINATION,
          total: 1,
        });
      },
    );

    it('delega la busqueda de texto junto con la paginacion existente', async () => {
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.listByProject.mockResolvedValue({ items: [], total: 1 });

      const result = await service.list(PROJECT_ID, ACTOR_ID, {
        page: FILTERS.page,
        pageSize: FILTERS.pageSize,
        q: FILTERS.q,
      });

      expect(repo.listByProject).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        page: 3,
        pageSize: 10,
        q: 'login',
      });
      expect(result).toEqual({ data: [], page: 3, pageSize: 10, total: 1 });
    });

    it.each([
      ['type', { type: 'BUG' }],
      ['status', { status: 'IN_REVIEW' }],
      ['priority', { priority: 'CRITICAL' }],
      ['assigneeId', { assigneeId: 'user_2' }],
    ] as const)('delega el filtro individual %s', async (_name, filter) => {
      repo.findMemberRole.mockResolvedValue('OWNER');
      repo.listByProject.mockResolvedValue({ items: [], total: 0 });

      await service.list(PROJECT_ID, ACTOR_ID, { page: 1, pageSize: 20, ...filter });

      expect(repo.listByProject).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        page: 1,
        pageSize: 20,
        ...filter,
      });
    });

    it('delega filtros combinados con AND', async () => {
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.listByProject.mockResolvedValue({ items: [], total: 0 });

      await service.list(PROJECT_ID, ACTOR_ID, {
        page: 1,
        pageSize: 20,
        type: 'BUG',
        priority: 'HIGH',
      });

      expect(repo.listByProject).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        page: 1,
        pageSize: 20,
        type: 'BUG',
        priority: 'HIGH',
      });
    });

    it('rechaza a un usuario que no pertenece al proyecto sin consultar el listado', async () => {
      repo.findMemberRole.mockResolvedValue(null);

      await expect(service.list(PROJECT_ID, ACTOR_ID, PAGINATION)).rejects.toBeInstanceOf(
        ForbiddenError,
      );

      expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
      expect(repo.listByProject).not.toHaveBeenCalled();
    });

    it('convierte los elementos a DTO y conserva la metadata de paginacion', async () => {
      const assignee = usuarioDePrueba({ id: 'user_2', name: 'Grace Hopper' });
      const firstItem = itemDePrueba({
        id: 'item_2',
        reference: 'MIR-22',
        title: 'Primer elemento',
        description: null,
        estimate: 8,
        dueDate: new Date('2026-03-15T00:00:00.000Z'),
        assignee,
        sprintId: 'sprint_1',
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
        updatedAt: new Date('2026-03-13T11:00:00.000Z'),
      });
      const secondItem = itemDePrueba({
        id: 'item_1',
        reference: 'MIR-21',
        title: 'Segundo elemento',
      });
      const repositoryResult: ListWorkItemsResult = {
        items: [firstItem, secondItem],
        total: 41,
      };
      repo.findMemberRole.mockResolvedValue('OWNER');
      repo.listByProject.mockResolvedValue(repositoryResult);

      const result = await service.list(PROJECT_ID, ACTOR_ID, PAGINATION);

      expect(result).toEqual({
        data: [
          {
            id: 'item_2',
            reference: 'MIR-22',
            projectId: PROJECT_ID,
            title: 'Primer elemento',
            description: null,
            type: 'STORY',
            status: 'TODO',
            priority: 'HIGH',
            estimate: 8,
            dueDate: '2026-03-15T00:00:00.000Z',
            assignee: {
              id: 'user_2',
              name: 'Grace Hopper',
              email: 'ada@mira.dev',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            createdBy: {
              id: 'user_1',
              name: 'Ada Lovelace',
              email: 'ada@mira.dev',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            sprintId: 'sprint_1',
            createdAt: '2026-03-12T10:00:00.000Z',
            updatedAt: '2026-03-13T11:00:00.000Z',
          },
          toWorkItemDto(secondItem),
        ],
        page: 2,
        pageSize: 20,
        total: 41,
      });
    });

    it('propaga errores inesperados del repository', async () => {
      const error = new Error('No se pudo obtener el backlog');
      repo.findMemberRole.mockResolvedValue('OWNER');
      repo.listByProject.mockRejectedValue(error);

      await expect(service.list(PROJECT_ID, ACTOR_ID, PAGINATION)).rejects.toBe(error);
    });
  });

  describe('board', () => {
    it.each(['OWNER', 'MEMBER', 'VIEWER'] as const)('%s puede ver el tablero', async (role) => {
      const item = itemDePrueba();
      repo.findMemberRole.mockResolvedValue(role);
      repo.listBoardByProject.mockResolvedValue([item]);

      const result = await service.board(PROJECT_ID, ACTOR_ID);

      expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
      expect(repo.listBoardByProject).toHaveBeenCalledWith(PROJECT_ID);
      expect(result).toEqual([toWorkItemDto(item)]);
    });

    it('rechaza a un usuario que no pertenece al proyecto sin consultar el tablero', async () => {
      repo.findMemberRole.mockResolvedValue(null);

      await expect(service.board(PROJECT_ID, ACTOR_ID)).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.listBoardByProject).not.toHaveBeenCalled();
    });

    it('convierte cada item a DTO conservando el orden y el responsable', async () => {
      const assignee = usuarioDePrueba({
        id: 'user_2',
        name: 'Grace Hopper',
        email: 'grace@mira.dev',
      });
      const enProgreso = itemDePrueba({ id: 'item_2', status: 'IN_PROGRESS', assignee });
      const hecho = itemDePrueba({ id: 'item_3', status: 'DONE' });
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.listBoardByProject.mockResolvedValue([enProgreso, hecho]);

      const result = await service.board(PROJECT_ID, ACTOR_ID);

      expect(result.map((item) => item.id)).toEqual(['item_2', 'item_3']);
      expect(result[0]?.assignee).toEqual({
        id: 'user_2',
        name: 'Grace Hopper',
        email: 'grace@mira.dev',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(result[1]?.assignee).toBeNull();
    });

    it('devuelve un arreglo vacio cuando no hay items en el tablero', async () => {
      repo.findMemberRole.mockResolvedValue('VIEWER');
      repo.listBoardByProject.mockResolvedValue([]);

      await expect(service.board(PROJECT_ID, ACTOR_ID)).resolves.toEqual([]);
    });
  });

  describe('delete', () => {
    it.each(['OWNER', 'MEMBER'] as const)('%s puede eliminar el item', async (role) => {
      repo.findMemberRole.mockResolvedValue(role);
      repo.findByIdInProject.mockResolvedValue(itemDePrueba({ reference: 'MIR-12' }));
      repo.deleteAtomically.mockResolvedValue(undefined);

      await expect(service.delete(PROJECT_ID, ACTOR_ID, 'item_1')).resolves.toBeUndefined();

      expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
      expect(repo.findByIdInProject).toHaveBeenCalledWith(PROJECT_ID, 'item_1');
      expect(repo.deleteAtomically).toHaveBeenCalledTimes(1);
      expect(repo.deleteAtomically).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        actorId: ACTOR_ID,
        workItemId: 'item_1',
        reference: 'MIR-12',
      });
    });

    it('rechaza VIEWER sin buscar ni eliminar el item', async () => {
      repo.findMemberRole.mockResolvedValue('VIEWER');

      await expect(service.delete(PROJECT_ID, ACTOR_ID, 'item_1')).rejects.toBeInstanceOf(
        ForbiddenError,
      );

      expect(repo.findByIdInProject).not.toHaveBeenCalled();
      expect(repo.deleteAtomically).not.toHaveBeenCalled();
    });

    it('oculta al no miembro con NotFoundError como en el detalle', async () => {
      repo.findMemberRole.mockResolvedValue(null);

      await expect(service.delete(PROJECT_ID, ACTOR_ID, 'item_1')).rejects.toBeInstanceOf(
        NotFoundError,
      );

      expect(repo.findByIdInProject).not.toHaveBeenCalled();
      expect(repo.deleteAtomically).not.toHaveBeenCalled();
    });

    it.each(['item inexistente', 'item de otro proyecto'])(
      'rechaza %s sin intentar eliminar ni registrar actividad',
      async () => {
        repo.findMemberRole.mockResolvedValue('MEMBER');
        repo.findByIdInProject.mockResolvedValue(null);

        await expect(service.delete(PROJECT_ID, ACTOR_ID, 'item_1')).rejects.toBeInstanceOf(
          NotFoundError,
        );

        expect(repo.findByIdInProject).toHaveBeenCalledWith(PROJECT_ID, 'item_1');
        expect(repo.deleteAtomically).not.toHaveBeenCalled();
      },
    );

    it('propaga un fallo de persistencia sin informar exito', async () => {
      const error = new Error('No se pudo eliminar el item');
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.findByIdInProject.mockResolvedValue(itemDePrueba());
      repo.deleteAtomically.mockRejectedValue(error);

      await expect(service.delete(PROJECT_ID, ACTOR_ID, 'item_1')).rejects.toBe(error);
    });
  });

  describe('getById', () => {
    it.each(['OWNER', 'MEMBER', 'VIEWER'] as const)(
      '%s puede ver un elemento de trabajo',
      async (role) => {
        repo.findMemberRole.mockResolvedValue(role);
        repo.findByIdInProject.mockResolvedValue(itemDePrueba());

        await expect(service.getById(PROJECT_ID, ACTOR_ID, 'item_1')).resolves.toMatchObject({
          id: 'item_1',
          reference: 'MIR-1',
        });
      },
    );

    it('consulta la membresia y busca el item con los identificadores correctos', async () => {
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.findByIdInProject.mockResolvedValue(itemDePrueba());

      await service.getById(PROJECT_ID, ACTOR_ID, 'item_1');

      expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
      expect(repo.findByIdInProject).toHaveBeenCalledWith(PROJECT_ID, 'item_1');
    });

    it('oculta al no miembro con NotFoundError sin buscar el item', async () => {
      repo.findMemberRole.mockResolvedValue(null);

      await expect(service.getById(PROJECT_ID, ACTOR_ID, 'item_1')).rejects.toBeInstanceOf(
        NotFoundError,
      );

      expect(repo.findByIdInProject).not.toHaveBeenCalled();
    });

    it.each(['un identificador inexistente', 'un item que pertenece a otro proyecto'])(
      'responde NotFoundError para %s',
      async () => {
        repo.findMemberRole.mockResolvedValue('VIEWER');
        repo.findByIdInProject.mockResolvedValue(null);

        await expect(
          service.getById(PROJECT_ID, ACTOR_ID, 'item_inexistente'),
        ).rejects.toBeInstanceOf(NotFoundError);
      },
    );

    it('serializa completamente el item y sus campos nullable', async () => {
      const createdBy = usuarioDePrueba({ createdAt: new Date('2026-01-02T03:04:05.000Z') });
      const assignee = usuarioDePrueba({
        id: 'user_2',
        name: 'Grace Hopper',
        email: 'grace@mira.dev',
        createdAt: new Date('2026-01-03T04:05:06.000Z'),
      });
      repo.findMemberRole.mockResolvedValue('OWNER');
      repo.findByIdInProject.mockResolvedValue(
        itemDePrueba({
          dueDate: new Date('2026-03-15T12:00:00.000Z'),
          createdBy,
          assignee,
        }),
      );

      await expect(service.getById(PROJECT_ID, ACTOR_ID, 'item_1')).resolves.toEqual({
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
