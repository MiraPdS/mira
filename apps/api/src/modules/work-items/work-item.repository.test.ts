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
    ['columnId', { columnId: 'column_1' }],
    ['priority', { priority: 'HIGH' }],
    ['assigneeId', { assigneeId: 'user_2' }],
  ] as const)('agrega el filtro individual %s al proyecto', (_name, filter) => {
    expect(workItemWhereForList({ ...PAGE, ...filter })).toEqual({
      projectId: 'project_1',
      ...filter,
    });
  });

  // MIR-31: el estado ya no es una columna de work_items; se deriva de la
  // columna del tablero (ver legacyStatusOf en packages/shared).
  it('filtra BACKLOG como elementos sin columna', () => {
    expect(workItemWhereForList({ ...PAGE, status: 'BACKLOG' })).toEqual({
      projectId: 'project_1',
      AND: [{ columnId: null }],
    });
  });

  it('filtra un estado que tambien es categoria por su columna por defecto o por categoria', () => {
    expect(workItemWhereForList({ ...PAGE, status: 'IN_PROGRESS' })).toEqual({
      projectId: 'project_1',
      AND: [
        {
          column: {
            OR: [{ legacyStatus: 'IN_PROGRESS' }, { legacyStatus: null, category: 'IN_PROGRESS' }],
          },
        },
      ],
    });
  });

  it('filtra IN_REVIEW solo por su columna por defecto (no es una categoria)', () => {
    expect(workItemWhereForList({ ...PAGE, status: 'IN_REVIEW' })).toEqual({
      projectId: 'project_1',
      AND: [{ column: { legacyStatus: 'IN_REVIEW' } }],
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
