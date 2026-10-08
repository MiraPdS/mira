import { describe, expect, it } from 'vitest';
import { createProjectSchema, projectKeySchema } from './project.js';

describe('projectKeySchema', () => {
  it.each([
    ['MI', true, 'minimo valido: 2 caracteres'],
    ['MIRA2026', true, 'maximo valido: 8 caracteres'],
    ['A1', true, 'letra seguida de numero'],
    ['M', false, 'menos de 2 caracteres'],
    ['MIRA20261', false, 'mas de 8 caracteres'],
    ['1MIR', false, 'empieza con numero'],
    ['MI-R', false, 'con guion'],
    ['MI R', false, 'con espacio interno'],
    ['', false, 'vacia'],
  ])('%s -> %s (%s)', (value, esperado) => {
    expect(projectKeySchema.safeParse(value).success).toBe(esperado);
  });

  it('normaliza a mayusculas y sin espacios en los extremos', () => {
    expect(projectKeySchema.parse('  mira ')).toBe('MIRA');
  });
});

describe('createProjectSchema', () => {
  const valido = { name: 'Mira', key: 'MIR' };

  it('acepta una entrada valida sin descripcion', () => {
    expect(createProjectSchema.safeParse(valido).success).toBe(true);
  });

  it('rechaza un nombre de menos de 3 caracteres', () => {
    expect(createProjectSchema.safeParse({ ...valido, name: 'Mi' }).success).toBe(false);
  });

  it('rechaza un cuerpo sin clave', () => {
    expect(createProjectSchema.safeParse({ name: 'Mira' }).success).toBe(false);
  });
});
