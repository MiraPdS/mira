import { describe, expect, it } from 'vitest';
import { updateWorkItemSchema } from './work-item.js';

describe('updateWorkItemSchema', () => {
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
    ['sprintId', 'sprint_1'],
  ])('rechaza %s porque pertenece a otra historia', (field, value) => {
    expect(updateWorkItemSchema.safeParse({ [field]: value }).success).toBe(false);
  });

  it('rechaza campos desconocidos y valores invalidos', () => {
    expect(updateWorkItemSchema.safeParse({ title: 'No', unexpected: true }).success).toBe(false);
    expect(updateWorkItemSchema.safeParse({ estimate: 1.5 }).success).toBe(false);
  });
});
