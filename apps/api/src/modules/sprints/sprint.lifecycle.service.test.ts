import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { createSprintService } from './sprint.service.js';
import type { SprintRecord, SprintRepository } from './sprint.repository.js';

const sprint: SprintRecord = {
  id: 's1',
  projectId: 'p1',
  name: 'Sprint uno',
  goal: null,
  startDate: new Date('2026-11-01'),
  endDate: new Date('2026-11-14'),
  status: 'PLANNED',
  committedPoints: null,
  completedPoints: null,
  createdAt: new Date('2026-10-30'),
  updatedAt: new Date('2026-10-30'),
};
describe('MIR-46 lifecycle service', () => {
  let repo: MockProxy<SprintRepository>;
  let service: ReturnType<typeof createSprintService>;
  beforeEach(() => {
    repo = mock<SprintRepository>();
    repo.withTransaction.mockImplementation((operation) => operation(repo));
    repo.findMemberRole.mockResolvedValue('OWNER');
    repo.lockByIdInProject.mockResolvedValue(sprint);
    repo.hasActive.mockResolvedValue(false);
    repo.start.mockResolvedValue({ ...sprint, status: 'ACTIVE' });
    repo.close.mockResolvedValue({
      ...sprint,
      status: 'CLOSED',
      committedPoints: 8,
      completedPoints: 5,
    });
    repo.findDestination.mockResolvedValue({ ...sprint, id: 's2' });
    repo.listClosingItems.mockResolvedValue([]);
    service = createSprintService(repo);
  });
  const close = (destination: string | null = null) =>
    service.close('p1', 'u1', 's1', { moveUnfinishedToSprintId: destination });
  it.each(['start', 'close'] as const)(
    '%s comprueba permisos antes de bloquear',
    async (action) => {
      repo.findMemberRole.mockResolvedValue('VIEWER');
      await expect(
        action === 'start' ? service.start('p1', 'u1', 's1') : close(),
      ).rejects.toMatchObject({ status: 403 });
      expect(repo.lockByIdInProject).not.toHaveBeenCalled();
    },
  );
  it.each(['start', 'close'] as const)('%s oculta proyectos ajenos', async (action) => {
    repo.findMemberRole.mockResolvedValue(null);
    await expect(
      action === 'start' ? service.start('p1', 'u1', 's1') : close(),
    ).rejects.toMatchObject({ status: 404 });
  });
  it.each(['OWNER', 'MEMBER'] as const)('%s inicia PLANNED y cierra ACTIVE', async (role) => {
    repo.findMemberRole.mockResolvedValue(role);
    await expect(service.start('p1', 'u1', 's1')).resolves.toMatchObject({
      status: 'ACTIVE',
      committedPoints: null,
    });
    repo.lockByIdInProject.mockResolvedValue({ ...sprint, status: 'ACTIVE' });
    await close();
    expect(repo.start).toHaveBeenCalledWith('p1', 's1');
    expect(repo.close).toHaveBeenCalledWith(
      expect.objectContaining({ committedPoints: 0, completedPoints: 0 }),
    );
  });
  it.each(['start', 'close'] as const)(
    '%s devuelve 404 si no existe en el proyecto',
    async (action) => {
      repo.lockByIdInProject.mockResolvedValue(null);
      await expect(
        action === 'start' ? service.start('p1', 'u1', 's1') : close(),
      ).rejects.toMatchObject({ status: 404 });
    },
  );
  it.each(['ACTIVE', 'CLOSED'] as const)('no inicia %s', async (status) => {
    repo.lockByIdInProject.mockResolvedValue({ ...sprint, status });
    await expect(service.start('p1', 'u1', 's1')).rejects.toMatchObject({
      code: 'SPRINT_NOT_PLANNED',
    });
    expect(repo.start).not.toHaveBeenCalled();
  });
  it('rechaza segundo ACTIVE', async () => {
    repo.hasActive.mockResolvedValue(true);
    await expect(service.start('p1', 'u1', 's1')).rejects.toMatchObject({
      status: 409,
      code: 'SPRINT_ALREADY_ACTIVE',
    });
    expect(repo.start).not.toHaveBeenCalled();
  });
  it.each(['PLANNED', 'CLOSED'] as const)('no cierra %s', async (status) => {
    repo.lockByIdInProject.mockResolvedValue({ ...sprint, status });
    await expect(close()).rejects.toMatchObject({ code: 'SPRINT_NOT_ACTIVE' });
    expect(repo.close).not.toHaveBeenCalled();
  });
  it('snapshot usa categoria DONE y cero para null; solo mueve no terminados', async () => {
    repo.lockByIdInProject.mockResolvedValue({ ...sprint, status: 'ACTIVE' });
    const done = { id: 'i1', estimate: 5, column: { name: 'Publicado', category: 'DONE' } };
    const emptyDone = {
      id: 'i2',
      estimate: null,
      column: { name: 'Otro final', category: 'DONE' },
    };
    const unfinished = { id: 'i3', estimate: 3, column: { name: 'Hecho', category: 'TODO' } };
    const backlog = { id: 'i4', estimate: null, column: null };
    repo.listClosingItems.mockResolvedValue([done, emptyDone, unfinished, backlog]);
    await close('s2');
    expect(repo.close).toHaveBeenCalledWith({
      projectId: 'p1',
      actorId: 'u1',
      sprintId: 's1',
      destinationId: 's2',
      committedPoints: 8,
      completedPoints: 5,
      unfinished: [unfinished, backlog],
    });
  });
  it.each([
    ['s1', 'SPRINT_DESTINATION_SAME'],
    ['missing', 'SPRINT_NOT_FOUND'],
    ['foreign', 'SPRINT_PROJECT_MISMATCH'],
    ['active', 'SPRINT_DESTINATION_NOT_PLANNED'],
    ['closed', 'SPRINT_DESTINATION_NOT_PLANNED'],
  ])('rechaza destino %s antes de escribir', async (destination, code) => {
    repo.lockByIdInProject.mockResolvedValue({ ...sprint, status: 'ACTIVE' });
    repo.findDestination.mockResolvedValue(
      destination === 'missing'
        ? null
        : {
            ...sprint,
            projectId: destination === 'foreign' ? 'p2' : 'p1',
            status:
              destination === 'active' ? 'ACTIVE' : destination === 'closed' ? 'CLOSED' : 'PLANNED',
          },
    );
    await expect(close(destination)).rejects.toMatchObject({ code });
    expect(repo.close).not.toHaveBeenCalled();
  });
});
