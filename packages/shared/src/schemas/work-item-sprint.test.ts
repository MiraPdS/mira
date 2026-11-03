import { describe, expect, it } from 'vitest';
import { assignWorkItemSprintSchema, NO_SPRINT_FILTER, workItemFiltersSchema } from '../index.js';

describe('MIR-45 contratos', () => {
  it.each(['sprint_1', null])('acepta sprintId %j', (sprintId) => {
    expect(assignWorkItemSprintSchema.parse({ sprintId })).toEqual({ sprintId });
  });
  it('normaliza el id sin convertir null', () => {
    expect(assignWorkItemSprintSchema.parse({ sprintId: '  sprint_1 ' })).toEqual({
      sprintId: 'sprint_1',
    });
  });
  it.each([
    {},
    { sprintId: '' },
    { sprintId: '  ' },
    { sprintId: 1 },
    { sprintId: null, columnId: 'column_done' },
  ])('rechaza %j', (input) => {
    expect(assignWorkItemSprintSchema.safeParse(input).success).toBe(false);
  });
  it.each([undefined, 'sprint_1', NO_SPRINT_FILTER])(
    'acepta filtro %j con paginacion y otros filtros',
    (sprintId) => {
      expect(
        workItemFiltersSchema.parse({ sprintId, q: ' API ', columnId: 'column_1', page: '2' }),
      ).toMatchObject({ sprintId, q: 'API', columnId: 'column_1', page: 2 });
    },
  );
  it.each(['', '  ', null, ['sprint_1', 'sprint_2']])('rechaza filtro invalido %j', (sprintId) => {
    expect(workItemFiltersSchema.safeParse({ sprintId }).success).toBe(false);
  });
});
