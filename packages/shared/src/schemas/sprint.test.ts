import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  SPRINT_STATUSES,
  createSprintSchema,
  sprintListItemSchema,
  sprintSchema,
  updateSprintSchema,
  type CreateSprintInput,
  type SprintDto,
  type SprintListItemDto,
  type SprintStatus,
  type UpdateSprintInput,
} from '../index.js';

const input = {
  name: 'Sprint inicial',
  startDate: '2026-10-28',
  endDate: '2026-11-11',
};

const sprint = {
  id: 'sprint_1',
  projectId: 'project_1',
  ...input,
  goal: null,
  status: 'PLANNED',
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};

describe('createSprintSchema', () => {
  it('acepta nombre y fechas sin objetivo y conserva las fechas de calendario', () => {
    const parsed = createSprintSchema.parse(input);
    expect(parsed).toEqual(input);
    expectTypeOf(parsed).toEqualTypeOf<CreateSprintInput>();
  });

  it('normaliza nombre y objetivo', () => {
    expect(
      createSprintSchema.parse({ ...input, name: '  Sprint inicial  ', goal: '  Entregar API  ' }),
    ).toMatchObject({ name: 'Sprint inicial', goal: 'Entregar API' });
  });

  it.each([null, '', '   '])('acepta objetivo %j y lo normaliza a null', (goal) => {
    expect(createSprintSchema.parse({ ...input, goal }).goal).toBeNull();
  });

  it.each([{ name: '  ' }, { name: 'ab' }, { name: 'a'.repeat(121) }, { goal: 'a'.repeat(2001) }])(
    'rechaza limites invalidos: %j',
    (override) => {
      expect(createSprintSchema.safeParse({ ...input, ...override }).success).toBe(false);
    },
  );

  it.each(['name', 'startDate', 'endDate'] as const)('exige %s', (field) => {
    const incomplete: Record<string, unknown> = { ...input };
    delete incomplete[field];
    expect(createSprintSchema.safeParse(incomplete).success).toBe(false);
  });

  it.each(['startDate', 'endDate'] as const)('rechaza valores que no son fechas en %s', (field) => {
    for (const value of [
      null,
      0,
      new Date('2026-10-28T00:00:00.000Z'),
      '',
      '2026-1-01',
      '28-10-2026',
      '2026-10-28T00:00:00.000Z',
      '2026-02-29',
      '2026-04-31',
      '2026-13-01',
    ]) {
      const result = createSprintSchema.safeParse({ ...input, [field]: value });
      expect(result.success, `${field}: ${String(value)}`).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });

  it('acepta un dia bisiesto real y fechas iguales', () => {
    expect(
      createSprintSchema.parse({ ...input, startDate: '2028-02-29', endDate: '2028-02-29' }),
    ).toMatchObject({ startDate: '2028-02-29', endDate: '2028-02-29' });
  });

  it('asocia el intervalo invertido a endDate', () => {
    const result = createSprintSchema.safeParse({ ...input, endDate: '2026-10-27' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.endDate).toEqual([
      'La fecha de termino no puede ser anterior a la fecha de inicio',
    ]);
  });

  it.each([
    ['status', 'ACTIVE'],
    ['projectId', 'project_2'],
    ['id', 'sprint_2'],
    ['items', 1],
    ['points', 3],
  ])('rechaza el campo ajeno a creacion %s', (field, value) => {
    expect(createSprintSchema.safeParse({ ...input, [field]: value }).success).toBe(false);
  });
});

describe('updateSprintSchema', () => {
  it.each([
    { name: 'Sprint renombrado' },
    { goal: 'Nuevo objetivo' },
    { goal: null },
    { startDate: '2026-11-01' },
    { endDate: '2026-11-15' },
  ])('acepta una actualizacion parcial %j', (patch) => {
    const parsed = updateSprintSchema.parse(patch);
    expect(parsed).toEqual(patch);
    expectTypeOf(parsed).toEqualTypeOf<UpdateSprintInput>();
  });

  it('normaliza el objetivo vacio a null para quitarlo', () => {
    expect(updateSprintSchema.parse({ goal: '   ' })).toEqual({ goal: null });
  });

  it.each([{}, { name: undefined }])('rechaza un PATCH sin cambios enviados: %j', (patch) => {
    expect(updateSprintSchema.safeParse(patch).success).toBe(false);
  });

  it.each([
    { status: 'CLOSED' },
    { projectId: 'project_2' },
    { startDate: null },
    { endDate: null },
    { endDate: '2026-02-29' },
    { name: '  ' },
  ])('rechaza una actualizacion invalida %j', (patch) => {
    expect(updateSprintSchema.safeParse(patch).success).toBe(false);
  });

  it('valida el intervalo cuando llegan ambas fechas y senala endDate', () => {
    const result = updateSprintSchema.safeParse({
      startDate: '2026-11-12',
      endDate: '2026-11-11',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('acepta actualizar ambas fechas al mismo dia', () => {
    expect(
      updateSprintSchema.safeParse({ startDate: '2026-11-11', endDate: '2026-11-11' }).success,
    ).toBe(true);
  });
});

describe('sprintSchema', () => {
  it('exporta los tres estados definitivos', () => {
    expect(SPRINT_STATUSES).toEqual(['PLANNED', 'ACTIVE', 'CLOSED']);
    expectTypeOf<SprintStatus>().toEqualTypeOf<'PLANNED' | 'ACTIVE' | 'CLOSED'>();
  });

  it.each(SPRINT_STATUSES)('acepta estado %s y objetivo nullable', (status) => {
    const parsed = sprintSchema.parse({ ...sprint, status });
    expect(parsed.status).toBe(status);
    expect(parsed.goal).toBeNull();
    expectTypeOf(parsed).toEqualTypeOf<SprintDto>();
  });

  it('acepta un objetivo con contenido', () => {
    expect(sprintSchema.parse({ ...sprint, goal: 'Entregar API' }).goal).toBe('Entregar API');
  });

  it.each([
    { status: 'COMPLETED' },
    { status: undefined },
    { goal: undefined },
    { startDate: null },
    { endDate: '2026-11-11T00:00:00.000Z' },
    { endDate: '2026-10-27' },
    { createdAt: '2026-10-28' },
    { updatedAt: null },
  ])('rechaza un DTO invalido %j', (override) => {
    expect(sprintSchema.safeParse({ ...sprint, ...override }).success).toBe(false);
  });
});

describe('sprintListItemSchema', () => {
  it('acepta ceros para un sprint vacio sin incluir los WorkItem completos', () => {
    const dto = { ...sprint, items: 0, points: 0 };
    const parsed = sprintListItemSchema.parse(dto);
    expect(parsed).toEqual(dto);
    expectTypeOf(parsed).toEqualTypeOf<SprintListItemDto>();
  });

  it('acepta conteos enteros y puntos decimales no negativos', () => {
    expect(sprintListItemSchema.parse({ ...sprint, items: 2, points: 3.5 })).toMatchObject({
      items: 2,
      points: 3.5,
    });
  });

  it.each([
    { items: -1 },
    { items: 1.5 },
    { items: undefined },
    { items: [] },
    { points: -1 },
    { points: undefined },
    { points: Infinity },
    { points: NaN },
  ])('rechaza metricas invalidas %j', (override) => {
    expect(
      sprintListItemSchema.safeParse({ ...sprint, items: 0, points: 0, ...override }).success,
    ).toBe(false);
  });
});
