import { describe, expect, it } from 'vitest';
import { changeStatusSchema, updateWorkItemSchema, workItemFiltersSchema } from './work-item.js';

describe('updateWorkItemSchema', () => {
  it.each(['', '   '])('normaliza descripcion vacia %j a null', (description) => {
    expect(updateWorkItemSchema.parse({ description })).toEqual({ description: null });
    expect(updateWorkItemSchema.parse({ title: 'Titulo valido' })).toEqual({
      title: 'Titulo valido',
    });
  });
  it('acepta un PATCH parcial con los campos que pertenecen a MIR-15', () => {
    const result = updateWorkItemSchema.parse({
      title: '  Ajustar el contrato de edicion  ',
      type: 'BUG',
      priority: 'CRITICAL',
    });

    expect(result).toEqual({
      title: 'Ajustar el contrato de edicion',
      type: 'BUG',
      priority: 'CRITICAL',
    });
  });

  it('acepta null para los campos nullable y convierte la fecha', () => {
    const result = updateWorkItemSchema.parse({
      description: null,
      estimate: null,
      dueDate: null,
    });

    expect(result).toEqual({ description: null, estimate: null, dueDate: null });
    expect(updateWorkItemSchema.parse({ dueDate: '2026-03-15T12:00:00.000Z' }).dueDate).toEqual(
      new Date('2026-03-15T12:00:00.000Z'),
    );
  });

  it.each([
    ['assigneeId', 'user_2'],
    ['status', 'DONE'],
    ['columnId', 'col_1'],
    ['sprintId', 'sprint_1'],
  ])('rechaza %s porque pertenece a otra historia', (field, value) => {
    expect(updateWorkItemSchema.safeParse({ [field]: value }).success).toBe(false);
  });

  it('rechaza campos desconocidos y valores invalidos', () => {
    expect(updateWorkItemSchema.safeParse({ title: 'No', unexpected: true }).success).toBe(false);
    expect(updateWorkItemSchema.safeParse({ estimate: 1.5 }).success).toBe(false);
  });
});

describe('workItemFiltersSchema', () => {
  it('normaliza los filtros de MIR-13 y conserva los defaults de paginacion', () => {
    expect(
      workItemFiltersSchema.parse({
        q: '  Login  ',
        type: 'BUG',
        columnId: ' col_1 ',
        priority: 'HIGH',
        assigneeId: 'user_2',
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      q: 'Login',
      type: 'BUG',
      columnId: 'col_1',
      priority: 'HIGH',
      assigneeId: 'user_2',
    });
  });

  // MIR-49: el filtro "Estado" son las columnas del proyecto, mas el backlog.
  it('acepta BACKLOG como columna para filtrar lo que no esta en ninguna', () => {
    expect(workItemFiltersSchema.parse({ columnId: 'BACKLOG' }).columnId).toBe('BACKLOG');
  });

  it('ya no filtra por el estado antiguo', () => {
    expect(workItemFiltersSchema.parse({ status: 'TODO' })).not.toHaveProperty('status');
  });

  it('rechaza valores de filtro invalidos', () => {
    expect(workItemFiltersSchema.safeParse({ type: 'FEATURE' }).success).toBe(false);
    expect(workItemFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe('changeStatusSchema', () => {
  it.each([
    ['una columna', { columnId: 'col_1' }],
    ['null para volver al backlog', { columnId: null }],
  ])('acepta %s', (_caso, body) => {
    expect(changeStatusSchema.parse(body)).toEqual(body);
  });

  it.each([
    // MIR-49: el estado antiguo ya no es un destino valido.
    ['el estado antiguo', { status: 'DONE' }],
    ['columna y estado a la vez', { columnId: 'col_1', status: 'DONE' }],
    ['un cuerpo sin columna', {}],
    ['una columna vacia', { columnId: '   ' }],
    ['columna con campos ajenos', { columnId: 'col_1', title: 'Otro' }],
  ])('rechaza %s', (_caso, body) => {
    expect(changeStatusSchema.safeParse(body).success).toBe(false);
  });
});
