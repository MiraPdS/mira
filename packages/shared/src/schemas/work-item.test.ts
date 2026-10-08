import { describe, expect, it } from 'vitest';
import { changeStatusSchema, workItemFiltersSchema } from './work-item.js';

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

describe('changeStatusSchema', () => {
  it.each(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const)(
    'acepta el estado %s',
    (status) => {
      expect(changeStatusSchema.parse({ status })).toEqual({ status });
    },
  );

  it.each([
    ['un estado desconocido', { status: 'ARCHIVED' }],
    ['el estado en minuscula', { status: 'done' }],
    ['un cuerpo sin estado', {}],
    ['campos ajenos al movimiento', { status: 'DONE', title: 'Otro titulo' }],
  ])('rechaza %s', (_caso, body) => {
    expect(changeStatusSchema.safeParse(body).success).toBe(false);
  });
});
