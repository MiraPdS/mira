import { describe, expect, it } from 'vitest';
import { sortSprints } from './useSprints';

describe('sortSprints', () => {
  it('ordena activo, planificados y cerrados; dentro de cada grupo por fecha de inicio', () => {
    const sprints = [
      { id: 'c', status: 'CLOSED', startDate: '2026-09-01' },
      { id: 'p2', status: 'PLANNED', startDate: '2026-12-01' },
      { id: 'a', status: 'ACTIVE', startDate: '2026-10-01' },
      { id: 'p1', status: 'PLANNED', startDate: '2026-11-01' },
    ] as const;

    expect(sortSprints(sprints).map((sprint) => sprint.id)).toEqual(['a', 'p1', 'p2', 'c']);
  });

  it('desempata por id y no muta la lista original', () => {
    const sprints = [
      { id: 'b', status: 'PLANNED', startDate: '2026-11-01' },
      { id: 'a', status: 'PLANNED', startDate: '2026-11-01' },
    ] as const;

    expect(sortSprints(sprints).map((sprint) => sprint.id)).toEqual(['a', 'b']);
    expect(sprints.map((sprint) => sprint.id)).toEqual(['b', 'a']);
  });
});
