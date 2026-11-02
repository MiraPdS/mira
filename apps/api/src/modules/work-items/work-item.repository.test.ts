import { describe, expect, it } from 'vitest';
import { workItemWhereForList } from './work-item.repository.js';

const PAGE = { projectId: 'project_1', page: 1, pageSize: 20 };

describe('workItemWhereForList', () => {
  it('filtra sin sprint usando IS NULL', () => {
    expect(workItemWhereForList({ ...PAGE, sprintId: 'none' })).toEqual({
      projectId: PAGE.projectId,
      sprintId: null,
    });
  });
  it('filtra un sprint y exige que pertenezca al proyecto', () => {
    expect(workItemWhereForList({ ...PAGE, sprintId: 's1', columnId: 'column_1' })).toEqual({
      projectId: PAGE.projectId,
      sprintId: 's1',
      sprint: { projectId: PAGE.projectId },
      columnId: 'column_1',
    });
  });
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
    ['columnId', { columnId: 'column_1' }],
    ['priority', { priority: 'HIGH' }],
    ['assigneeId', { assigneeId: 'user_2' }],
  ] as const)('agrega el filtro individual %s al proyecto', (_name, filter) => {
    expect(workItemWhereForList({ ...PAGE, ...filter })).toEqual({
      projectId: 'project_1',
      ...filter,
    });
  });

  // MIR-49: el filtro "Estado" del backlog es una columna; BACKLOG es no
  // estar en ninguna.
  it('filtra BACKLOG como elementos sin columna', () => {
    expect(workItemWhereForList({ ...PAGE, columnId: 'BACKLOG' })).toEqual({
      projectId: 'project_1',
      columnId: null,
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
