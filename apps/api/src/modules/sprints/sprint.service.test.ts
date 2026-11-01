import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { SprintRecord, SprintRepository } from './sprint.repository.js';
import { createSprintService, toSprintDto } from './sprint.service.js';

const PROJECT = 'project_1';
const ACTOR = 'user_1';
const ID = 'sprint_1';
const input = { name: 'Sprint inicial', startDate: '2026-10-28', endDate: '2026-11-11' };
const record: SprintRecord = {
  id: ID,
  projectId: PROJECT,
  name: input.name,
  goal: null,
  startDate: new Date('2026-10-28T00:00:00.000Z'),
  endDate: new Date('2026-11-11T00:00:00.000Z'),
  status: 'PLANNED',
  committedPoints: null,
  completedPoints: null,
  createdAt: new Date('2026-10-28T12:00:00.000Z'),
  updatedAt: new Date('2026-10-28T13:00:00.000Z'),
};

describe('SprintService', () => {
  let repo: MockProxy<SprintRepository>;
  let service: ReturnType<typeof createSprintService>;

  beforeEach(() => {
    repo = mock<SprintRepository>();
    repo.withTransaction.mockImplementation((operation) => operation(repo));
    repo.findMemberRole.mockResolvedValue('OWNER');
    repo.findByIdInProject.mockResolvedValue(record);
    repo.create.mockResolvedValue(record);
    repo.update.mockResolvedValue(record);
    repo.listByProject.mockResolvedValue([{ ...record, items: 3, points: 8 }]);
    service = createSprintService(repo);
  });

  const actions = ['create', 'list', 'update', 'delete'] as const;
  function execute(action: (typeof actions)[number]) {
    switch (action) {
      case 'create':
        return service.create(PROJECT, ACTOR, input);
      case 'list':
        return service.list(PROJECT, ACTOR);
      case 'update':
        return service.update(PROJECT, ACTOR, ID, { name: 'Nuevo nombre' });
      case 'delete':
        return service.delete(PROJECT, ACTOR, ID);
    }
  }

  describe.each(actions)('%s', (action) => {
    it.each(['OWNER', 'MEMBER', 'VIEWER'] as const)(
      'comprueba los permisos de %s',
      async (role) => {
        repo.findMemberRole.mockResolvedValue(role);
        if (role === 'VIEWER' && action !== 'list') {
          await expect(execute(action)).rejects.toBeInstanceOf(ForbiddenError);
          expect(repo.create).not.toHaveBeenCalled();
          expect(repo.update).not.toHaveBeenCalled();
          expect(repo.delete).not.toHaveBeenCalled();
          expect(repo.findByIdInProject).not.toHaveBeenCalled();
        } else {
          await execute(action);
          expect(repo[action === 'list' ? 'listByProject' : action]).toHaveBeenCalledTimes(1);
        }
        expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT, ACTOR);
        expect(repo.withTransaction).toHaveBeenCalledTimes(1);
      },
    );

    it('oculta el recurso al no miembro con 404 sin leer ni mutar sprints', async () => {
      repo.findMemberRole.mockResolvedValue(null);
      await expect(execute(action)).rejects.toMatchObject({
        status: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'Proyecto no encontrado',
      });
      expect(repo.findByIdInProject).not.toHaveBeenCalled();
      expect(repo.listByProject).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  it('serializa fechas de calendario y timestamps sin campos internos', () => {
    expect(toSprintDto(record)).toEqual({
      id: ID,
      projectId: PROJECT,
      name: input.name,
      goal: null,
      status: 'PLANNED',
      committedPoints: null,
      completedPoints: null,
      startDate: '2026-10-28',
      endDate: '2026-11-11',
      createdAt: '2026-10-28T12:00:00.000Z',
      updatedAt: '2026-10-28T13:00:00.000Z',
    });
  });

  it('crea en el proyecto indicado y devuelve el sprint', async () => {
    await expect(service.create(PROJECT, ACTOR, input)).resolves.toEqual(toSprintDto(record));
    expect(repo.create).toHaveBeenCalledWith(PROJECT, input);
  });

  it('rechaza fechas invertidas antes de crear', async () => {
    await expect(
      service.create(PROJECT, ACTOR, { ...input, endDate: '2026-10-27' }),
    ).rejects.toMatchObject({ status: 422, fields: { endDate: expect.any(Array) } });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('lista conservando orden y metricas del repositorio', async () => {
    await expect(service.list(PROJECT, ACTOR)).resolves.toEqual([
      { ...toSprintDto(record), items: 3, points: 8 },
    ]);
    expect(repo.listByProject).toHaveBeenCalledWith(PROJECT);
  });

  it.each(['update', 'delete'] as const)(
    '%s usa id y proyecto y devuelve 404 si no existe alli',
    async (action) => {
      repo.findByIdInProject.mockResolvedValue(null);
      await expect(execute(action)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.findByIdInProject).toHaveBeenCalledWith(PROJECT, ID);
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    },
  );

  it.each([
    { startDate: '2026-11-12' },
    { endDate: '2026-10-27' },
    { startDate: '2026-12-01', endDate: '2026-11-30' },
  ])('valida las fechas efectivas de PATCH %j', async (patch) => {
    const result = service.update(PROJECT, ACTOR, ID, patch);
    await expect(result).rejects.toBeInstanceOf(ValidationError);
    await expect(result).rejects.toMatchObject({
      status: 422,
      fields: { endDate: expect.any(Array) },
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each([
    { startDate: '2026-11-11' },
    { endDate: '2026-10-28' },
    { startDate: '2026-12-01', endDate: '2026-12-01' },
    { name: 'Nombre nuevo', goal: null },
  ])('acepta PATCH valido, incluyendo igualdad, sin inventar otros cambios: %j', async (patch) => {
    await service.update(PROJECT, ACTOR, ID, patch);
    expect(repo.update).toHaveBeenCalledWith(PROJECT, ID, patch);
  });

  it('elimina solo el sprint buscado en el proyecto indicado', async () => {
    await service.delete(PROJECT, ACTOR, ID);
    expect(repo.delete).toHaveBeenCalledWith(PROJECT, ID);
  });

  it('usa el repositorio transaccional para la lectura y escritura del PATCH', async () => {
    const tx = mock<SprintRepository>();
    tx.findMemberRole.mockResolvedValue('MEMBER');
    tx.findByIdInProject.mockResolvedValue(record);
    tx.update.mockResolvedValue(record);
    repo.withTransaction.mockImplementation((operation) => operation(tx));
    await service.update(PROJECT, ACTOR, ID, { endDate: '2026-11-12' });
    expect(tx.findMemberRole).toHaveBeenCalledWith(PROJECT, ACTOR);
    expect(tx.findByIdInProject).toHaveBeenCalledWith(PROJECT, ID);
    expect(tx.update).toHaveBeenCalledWith(PROJECT, ID, { endDate: '2026-11-12' });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
