import { describe, expect, it } from 'vitest';
import { workItemActivityResponseSchema } from './activity.js';

const entrada = {
  id: 'a1',
  action: 'ITEM_STATUS_CHANGED',
  workItemId: 'w1',
  actor: { id: 'u1', name: 'Ada' },
  field: 'status',
  fromValue: 'TODO',
  toValue: 'IN_PROGRESS',
  createdAt: '2026-10-01T12:00:00.000Z',
};

describe('workItemActivityResponseSchema', () => {
  it('acepta entradas con su indicador de truncado', () => {
    expect(
      workItemActivityResponseSchema.safeParse({ data: [entrada], truncated: false }).success,
    ).toBe(true);
  });

  it('exige el indicador de truncado', () => {
    expect(workItemActivityResponseSchema.safeParse({ data: [entrada] }).success).toBe(false);
  });

  it('rechaza una accion desconocida', () => {
    const invalida = { ...entrada, action: 'ITEM_EXPLOTADO' };
    expect(
      workItemActivityResponseSchema.safeParse({ data: [invalida], truncated: false }).success,
    ).toBe(false);
  });
});
