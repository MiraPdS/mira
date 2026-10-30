import { describe, expect, it } from 'vitest';
import {
  BOARD_COLUMN_NAME_MAX_LENGTH,
  createBoardColumnSchema,
  deleteBoardColumnQuerySchema,
  reorderBoardColumnsSchema,
  updateBoardColumnSchema,
} from './board-column.js';

describe('createBoardColumnSchema', () => {
  it('recorta el nombre y exige una categoria valida', () => {
    expect(createBoardColumnSchema.parse({ name: '  QA  ', category: 'IN_PROGRESS' })).toEqual({
      name: 'QA',
      category: 'IN_PROGRESS',
    });
    expect(createBoardColumnSchema.safeParse({ name: 'QA', category: 'IN_REVIEW' }).success).toBe(
      false,
    );
  });

  it.each(['', '   ', 'x'.repeat(BOARD_COLUMN_NAME_MAX_LENGTH + 1)])(
    'rechaza el nombre %j',
    (name) => {
      expect(createBoardColumnSchema.safeParse({ name, category: 'TODO' }).success).toBe(false);
    },
  );

  it('no deja elegir la posicion: la columna siempre queda al final', () => {
    const result = createBoardColumnSchema.safeParse({ name: 'QA', category: 'TODO', position: 0 });
    expect(result.success).toBe(false);
  });
});

describe('updateBoardColumnSchema', () => {
  it('acepta solo el nombre o solo la categoria', () => {
    expect(updateBoardColumnSchema.parse({ name: 'Listo' })).toEqual({ name: 'Listo' });
    expect(updateBoardColumnSchema.parse({ category: 'DONE' })).toEqual({ category: 'DONE' });
  });

  it('rechaza un cuerpo vacio y la posicion', () => {
    expect(updateBoardColumnSchema.safeParse({}).success).toBe(false);
    expect(updateBoardColumnSchema.safeParse({ position: 2 }).success).toBe(false);
  });
});

describe('reorderBoardColumnsSchema', () => {
  it('acepta la lista de columnas en su nuevo orden', () => {
    expect(reorderBoardColumnsSchema.parse({ columnIds: ['b', 'a'] })).toEqual({
      columnIds: ['b', 'a'],
    });
  });

  it.each([[[]], [['a', 'a']]])('rechaza %j', (columnIds) => {
    expect(reorderBoardColumnsSchema.safeParse({ columnIds }).success).toBe(false);
  });
});

describe('deleteBoardColumnQuerySchema', () => {
  it('el destino es opcional, pero no puede venir vacio', () => {
    expect(deleteBoardColumnQuerySchema.parse({})).toEqual({});
    expect(deleteBoardColumnQuerySchema.parse({ moveTo: 'col_1' })).toEqual({ moveTo: 'col_1' });
    expect(deleteBoardColumnQuerySchema.safeParse({ moveTo: '' }).success).toBe(false);
  });
});
