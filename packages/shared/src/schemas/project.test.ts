import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  projectKeySchema,
  projectSummarySchema,
  updateProjectSchema,
} from './project.js';

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

  it.each(['', '   '])('normaliza la descripcion %j a null', (description) => {
    expect(createProjectSchema.parse({ ...valido, description }).description).toBeNull();
  });
});

describe('updateProjectSchema', () => {
  it('acepta solo el nombre', () => {
    expect(updateProjectSchema.parse({ name: '  Mira 2 ' })).toEqual({ name: 'Mira 2' });
  });

  it('acepta description null para vaciarla', () => {
    expect(updateProjectSchema.parse({ description: null })).toEqual({ description: null });
  });

  it.each(['', '   '])('normaliza la descripcion %j a null', (description) => {
    expect(updateProjectSchema.parse({ description })).toEqual({ description: null });
  });

  it('rechaza la clave: es inmutable', () => {
    expect(updateProjectSchema.safeParse({ key: 'NUEVA' }).success).toBe(false);
  });

  it('rechaza campos desconocidos', () => {
    expect(updateProjectSchema.safeParse({ name: 'Mira', color: 'rojo' }).success).toBe(false);
  });

  it('rechaza un cuerpo vacio', () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Debes enviar al menos un campo');
  });
});

describe('projectSummarySchema (MIR-23)', () => {
  const vacio = {
    total: 0,
    byStatus: { BACKLOG: 0, TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 },
    byType: { EPIC: 0, STORY: 0, TASK: 0, BUG: 0 },
    byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    recentActivity: [],
  };

  it('acepta el resumen de un proyecto vacio', () => {
    expect(projectSummarySchema.safeParse(vacio).success).toBe(true);
  });

  it('rechaza un conteo al que le falta un estado', () => {
    const { DONE: _omitido, ...sinDone } = vacio.byStatus;
    expect(projectSummarySchema.safeParse({ ...vacio, byStatus: sinDone }).success).toBe(false);
  });

  it('rechaza conteos negativos', () => {
    const negativo = { ...vacio, byType: { ...vacio.byType, BUG: -1 } };
    expect(projectSummarySchema.safeParse(negativo).success).toBe(false);
  });

  it('rechaza una accion de actividad desconocida', () => {
    const actividad = {
      id: 'a1',
      action: 'ITEM_EXPLOTADO',
      workItemId: null,
      actor: { id: 'u1', name: 'Ada' },
      field: null,
      fromValue: null,
      toValue: null,
      createdAt: '2026-10-01T12:00:00.000Z',
    };
    expect(projectSummarySchema.safeParse({ ...vacio, recentActivity: [actividad] }).success).toBe(
      false,
    );
  });
});
