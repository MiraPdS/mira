import { describe, expect, it } from 'vitest';
import { workItemFiltersSchema } from './work-item.js';

describe('workItemFiltersSchema', () => {
  it('normaliza los filtros de MIR-13 y conserva los defaults de paginacion', () => {
    expect(
      workItemFiltersSchema.parse({
        q: '  Login  ',
        type: 'BUG',
        status: 'TODO',
        priority: 'HIGH',
        assigneeId: 'user_2',
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      q: 'Login',
      type: 'BUG',
      status: 'TODO',
      priority: 'HIGH',
      assigneeId: 'user_2',
    });
  });

  it('rechaza valores de filtro invalidos', () => {
    expect(workItemFiltersSchema.safeParse({ type: 'FEATURE' }).success).toBe(false);
    expect(workItemFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  });
});
