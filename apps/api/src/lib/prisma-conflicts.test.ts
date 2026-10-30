import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isSerializationConflict } from './prisma.js';

describe('conflictos Serializable de Prisma ORM y raw', () => {
  it.each([
    ['P2034', undefined, true],
    ['P2010', { code: '40001' }, true],
    ['P2010', { code: '40P01' }, true],
    ['P2010', { code: '23503' }, false],
    ['P2010', undefined, false],
    ['P2002', undefined, false],
  ] as const)('reconoce %s / %j', (code, meta, expected) => {
    expect(
      isSerializationConflict(
        new Prisma.PrismaClientKnownRequestError('conflict', { code, meta, clientVersion: '6' }),
      ),
    ).toBe(expected);
  });
  it('no reintenta errores ajenos a Prisma', () => {
    expect(isSerializationConflict(new Error('fail'))).toBe(false);
  });
});
