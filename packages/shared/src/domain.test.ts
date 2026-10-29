import { describe, expect, it } from 'vitest';
import { BOARD_STATUSES, DEFAULT_BOARD_COLUMNS, legacyStatusOf } from './domain.js';

describe('DEFAULT_BOARD_COLUMNS (MIR-31)', () => {
  it('reproduce las columnas fijas de la Entrega 1, en el mismo orden', () => {
    expect(DEFAULT_BOARD_COLUMNS.map((column) => column.legacyStatus)).toEqual(BOARD_STATUSES);
  });

  it('solo Hecho cuenta como terminado', () => {
    expect(
      DEFAULT_BOARD_COLUMNS.filter((column) => column.category === 'DONE').map((c) => c.name),
    ).toEqual(['Hecho']);
  });
});

describe('legacyStatusOf (puente MIR-31 -> MIR-49)', () => {
  it('sin columna es BACKLOG', () => {
    expect(legacyStatusOf(null)).toBe('BACKLOG');
  });

  it('una columna por defecto devuelve su estado, aunque su categoria sea otra', () => {
    expect(legacyStatusOf({ category: 'IN_PROGRESS', legacyStatus: 'IN_REVIEW' })).toBe(
      'IN_REVIEW',
    );
  });

  it.each(['TODO', 'IN_PROGRESS', 'DONE'] as const)(
    'una columna nueva de categoria %s usa su categoria',
    (category) => {
      expect(legacyStatusOf({ category, legacyStatus: null })).toBe(category);
    },
  );
});
