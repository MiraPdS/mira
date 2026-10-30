import { describe, expect, it } from 'vitest';
import { closeSprintSchema, sprintSchema } from '../index.js';

describe('MIR-46 contratos', () => {
  it.each([null, 'sprint_2'])('acepta destino %s', (moveUnfinishedToSprintId) => {
    expect(closeSprintSchema.parse({ moveUnfinishedToSprintId })).toEqual({
      moveUnfinishedToSprintId,
    });
  });
  it('normaliza destino', () => {
    expect(closeSprintSchema.parse({ moveUnfinishedToSprintId: ' s2 ' })).toEqual({
      moveUnfinishedToSprintId: 's2',
    });
  });
  it.each([
    {},
    { moveUnfinishedToSprintId: '' },
    { moveUnfinishedToSprintId: ' ' },
    { moveUnfinishedToSprintId: 2 },
    { moveUnfinishedToSprintId: null, status: 'CLOSED' },
    { moveUnfinishedToSprintId: null, committedPoints: 12 },
  ])('rechaza contrato invalido %j', (input) => {
    expect(closeSprintSchema.safeParse(input).success).toBe(false);
  });
  it.each([-1, 1.5, NaN, Infinity])('rechaza snapshot invalido %s', (value) => {
    expect(
      sprintSchema.safeParse({
        id: 's1',
        projectId: 'p1',
        name: 'Sprint',
        goal: null,
        startDate: '2026-11-01',
        endDate: '2026-11-14',
        status: 'CLOSED',
        createdAt: '2026-10-30T00:00:00Z',
        updatedAt: '2026-10-30T00:00:00Z',
        committedPoints: value,
        completedPoints: 0,
      }).success,
    ).toBe(false);
  });
});
