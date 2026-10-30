import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_COLUMNS } from './domain.js';

describe('DEFAULT_BOARD_COLUMNS (MIR-31)', () => {
  it('reproduce las columnas fijas de la Entrega 1, en el mismo orden', () => {
    expect(DEFAULT_BOARD_COLUMNS.map((column) => column.name)).toEqual([
      'Por hacer',
      'En progreso',
      'En revision',
      'Hecho',
    ]);
  });

  it('solo Hecho cuenta como terminado', () => {
    expect(
      DEFAULT_BOARD_COLUMNS.filter((column) => column.category === 'DONE').map((c) => c.name),
    ).toEqual(['Hecho']);
  });
});
