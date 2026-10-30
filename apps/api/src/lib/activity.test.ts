import { describe, expect, it } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { ActivityLog, PrismaClient } from '@prisma/client';
import { resolveActivityNames } from './activity.js';

const event = (fromValue: string | null, toValue: string | null): ActivityLog => ({
  id: 'a1',
  action: 'ITEM_UPDATED',
  projectId: 'p1',
  workItemId: 'i1',
  actorId: 'u1',
  field: 'sprintId',
  fromValue,
  toValue,
  createdAt: new Date('2026-10-29T00:00:00Z'),
});
describe('resolucion por lote de sprints', () => {
  it('resuelve todos los ids con una sola consulta y conserva null y eliminados', async () => {
    const db = mockDeep<PrismaClient>();
    db.sprint.findMany.mockResolvedValue([
      { id: 's1', projectId: 'p1', name: 'Sprint uno' },
      { id: 's2', projectId: 'p1', name: 'Sprint dos' },
    ] as Awaited<ReturnType<typeof db.sprint.findMany>>);
    const result = await resolveActivityNames(db, [
      event(null, 's1'),
      event('s1', 's2'),
      event('deleted', null),
    ]);
    expect(result.map(({ fromValue, toValue }) => [fromValue, toValue])).toEqual([
      [null, 'Sprint uno'],
      ['Sprint uno', 'Sprint dos'],
      ['Sprint eliminado', null],
    ]);
    expect(db.sprint.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
  it('respeta el proyecto y conserva nombres de usuarios y columnas', async () => {
    const db = mockDeep<PrismaClient>();
    db.user.findMany.mockResolvedValue([{ id: 'u2', name: 'Ada' }] as Awaited<
      ReturnType<typeof db.user.findMany>
    >);
    db.sprint.findMany.mockResolvedValue([
      { id: 's1', projectId: 'p2', name: 'Sprint privado' },
    ] as Awaited<ReturnType<typeof db.sprint.findMany>>);
    const user = { ...event(null, 'u2'), field: 'assigneeId', action: 'ITEM_ASSIGNED' as const };
    const column = {
      ...event('Por hacer', 'En progreso'),
      field: 'status',
      action: 'ITEM_STATUS_CHANGED' as const,
    };
    const result = await resolveActivityNames(db, [
      event('s1', null),
      { ...event(null, 's1'), projectId: 'p2' },
      user,
      column,
    ]);
    expect(result.map(({ fromValue, toValue }) => [fromValue, toValue])).toEqual([
      ['Sprint eliminado', null],
      [null, 'Sprint privado'],
      [null, 'Ada'],
      ['Por hacer', 'En progreso'],
    ]);
    expect(db.sprint.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['s1'] }, projectId: { in: ['p1', 'p2'] } },
      select: { id: true, name: true, projectId: true },
    });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
  });
  it('no consulta tablas sin referencias', async () => {
    const db = mockDeep<PrismaClient>();
    expect(await resolveActivityNames(db, [])).toEqual([]);
    expect(db.sprint.findMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});
