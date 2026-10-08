import { describe, expect, it } from 'vitest';
import { workItemWhereForList } from './work-item.repository.js';

const PAGE = { projectId: 'project_1', page: 1, pageSize: 20 };

describe('workItemWhereForList', () => {
  it('busca titulo o descripcion sin distinguir mayusculas', () => {
    expect(workItemWhereForList({ ...PAGE, q: 'login' })).toEqual({
      projectId: 'project_1',
      OR: [
        { title: { contains: 'login', mode: 'insensitive' } },
        { description: { contains: 'login', mode: 'insensitive' } },
      ],
    });
  });

  it.each([
    ['type', { type: 'BUG' }],
    ['status', { status: 'IN_PROGRESS' }],
    ['priority', { priority: 'HIGH' }],
    ['assigneeId', { assigneeId: 'user_2' }],
  ] as const)('agrega el filtro individual %s al proyecto', (_name, filter) => {
    expect(workItemWhereForList({ ...PAGE, ...filter })).toEqual({
      projectId: 'project_1',
      ...filter,
    });
  });

  it('combina filtros de enum con AND', () => {
    expect(workItemWhereForList({ ...PAGE, type: 'BUG', priority: 'HIGH' })).toEqual({
      projectId: 'project_1',
      type: 'BUG',
      priority: 'HIGH',
    });
  });

  it('mantiene el where de MIR-12 si no se envian filtros', () => {
    expect(workItemWhereForList(PAGE)).toEqual({ projectId: 'project_1' });
  });
});
