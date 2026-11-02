import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { WorkItemForDto, WorkItemRepository } from './work-item.repository.js';
import { createWorkItemService } from './work-item.service.js';

const user = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@test.dev',
  createdAt: new Date('2026-10-01T00:00:00Z'),
};
const item: WorkItemForDto = {
  id: 'i1',
  reference: 'MIR-1',
  projectId: 'p1',
  title: 'API',
  description: null,
  type: 'TASK',
  columnId: null,
  column: null,
  priority: 'MEDIUM',
  estimate: null,
  dueDate: null,
  assignee: null,
  createdBy: user,
  sprintId: null,
  createdAt: user.createdAt,
  updatedAt: user.createdAt,
};

describe('MIR-45 service', () => {
  let repo: MockProxy<WorkItemRepository>;
  let service: ReturnType<typeof createWorkItemService>;
  beforeEach(() => {
    repo = mock<WorkItemRepository>();
    repo.withTransaction.mockImplementation((fn) => fn(repo));
    repo.findMemberRole.mockResolvedValue('MEMBER');
    repo.findByIdInProject.mockResolvedValue(item);
    repo.findWorkItemProjectId.mockResolvedValue(null);
    repo.findSprintForAssignment.mockResolvedValue({
      id: 's1',
      projectId: 'p1',
      status: 'PLANNED',
    });
    repo.assignSprintAtomically.mockResolvedValue({ ...item, sprintId: 's1' });
    service = createWorkItemService(repo);
  });
  const assign = (sprintId: string | null = 's1') =>
    service.assignSprint('p1', 'u1', 'i1', { sprintId });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s asigna atomicamente usando el proyecto del path',
    async (role) => {
      repo.findMemberRole.mockResolvedValue(role);
      await expect(assign()).resolves.toMatchObject({ sprintId: 's1' });
      expect(repo.assignSprintAtomically).toHaveBeenCalledWith({
        projectId: 'p1',
        actorId: 'u1',
        workItemId: 'i1',
        fromSprintId: null,
        toSprintId: 's1',
      });
      expect(repo.findByIdInProject).toHaveBeenCalledWith('p1', 'i1');
    },
  );
  it.each([
    ['VIEWER', 403],
    [null, 404],
  ] as const)('rol %s recibe %s sin consultar destinos', async (role, status) => {
    repo.findMemberRole.mockResolvedValue(role);
    await expect(assign()).rejects.toMatchObject({ status });
    expect(repo.findByIdInProject).not.toHaveBeenCalled();
    expect(repo.findSprintForAssignment).not.toHaveBeenCalled();
    expect(repo.assignSprintAtomically).not.toHaveBeenCalled();
  });
  it.each(['PLANNED', 'ACTIVE'] as const)('permite destino %s', async (status) => {
    repo.findSprintForAssignment.mockResolvedValue({ id: 's1', projectId: 'p1', status });
    await expect(assign()).resolves.toMatchObject({ sprintId: 's1' });
  });
  it.each([null, 's1'])('CLOSED da 409 incluso si el actual es %s', async (sprintId) => {
    repo.findByIdInProject.mockResolvedValue({ ...item, sprintId });
    repo.findSprintForAssignment.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'CLOSED' });
    await expect(assign()).rejects.toMatchObject({ status: 409, code: 'SPRINT_CLOSED' });
    expect(repo.assignSprintAtomically).not.toHaveBeenCalled();
  });
  it('permite quitar desde CLOSED sin validar el sprint anterior', async () => {
    repo.findByIdInProject.mockResolvedValue({ ...item, sprintId: 'closed' });
    repo.assignSprintAtomically.mockResolvedValue(item);
    await expect(assign(null)).resolves.toMatchObject({ sprintId: null });
    expect(repo.findSprintForAssignment).not.toHaveBeenCalled();
    expect(repo.assignSprintAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ fromSprintId: 'closed', toSprintId: null }),
    );
  });
  it.each([null, 's1'])('no escribe ni duplica historial para %s sin cambio', async (sprintId) => {
    repo.findByIdInProject.mockResolvedValue({ ...item, sprintId });
    await assign(sprintId);
    expect(repo.assignSprintAtomically).not.toHaveBeenCalled();
  });
  it('item inexistente da 404', async () => {
    repo.findByIdInProject.mockResolvedValue(null);
    await expect(assign()).rejects.toMatchObject({ status: 404 });
    expect(repo.findSprintForAssignment).not.toHaveBeenCalled();
  });
  it('item de otro proyecto da 400', async () => {
    repo.findByIdInProject.mockResolvedValue(null);
    repo.findWorkItemProjectId.mockResolvedValue('p2');
    await expect(assign()).rejects.toMatchObject({
      status: 400,
      code: 'WORK_ITEM_PROJECT_MISMATCH',
    });
  });
  it('sprint inexistente da 404', async () => {
    repo.findSprintForAssignment.mockResolvedValue(null);
    await expect(assign()).rejects.toMatchObject({ status: 404, code: 'SPRINT_NOT_FOUND' });
  });
  it('sprint cruzado da 400 antes de evaluar CLOSED', async () => {
    repo.findSprintForAssignment.mockResolvedValue({ id: 's1', projectId: 'p2', status: 'CLOSED' });
    await expect(assign()).rejects.toMatchObject({ status: 400, code: 'SPRINT_PROJECT_MISMATCH' });
    expect(repo.assignSprintAtomically).not.toHaveBeenCalled();
  });
});
