import { describe, expect, it } from 'vitest';
import type { ActivityAction } from '@mira/shared';
import { describeActivity, type ActivityContext } from './describeActivity';

function entrada(
  action: ActivityAction,
  field: string | null = null,
  fromValue: string | null = null,
  toValue: string | null = null,
) {
  return { action, field, fromValue, toValue };
}

describe('describeActivity en el historial de un elemento (MIR-22)', () => {
  it.each([
    ['creación', entrada('ITEM_CREATED'), 'creó el ítem'],
    [
      'cambio de estado',
      entrada('ITEM_STATUS_CHANGED', 'status', 'TODO', 'IN_PROGRESS'),
      'movió de Por hacer a En progreso',
    ],
    [
      'prioridad',
      entrada('ITEM_UPDATED', 'priority', 'MEDIUM', 'HIGH'),
      'cambió la prioridad de Media a Alta',
    ],
    ['tipo', entrada('ITEM_UPDATED', 'type', 'TASK', 'BUG'), 'cambió el tipo de Tarea a Bug'],
    [
      'título',
      entrada('ITEM_UPDATED', 'title', 'Login', 'Login con Google'),
      'cambió el título de «Login» a «Login con Google»',
    ],
    [
      'descripción, sin mostrar su texto',
      entrada('ITEM_UPDATED', 'description', 'Texto viejo', 'Texto nuevo'),
      'editó la descripción',
    ],
    [
      'estimación cambiada',
      entrada('ITEM_UPDATED', 'estimate', '3', '5'),
      'cambió la estimación de 3 a 5 pts',
    ],
    ['estimación nueva', entrada('ITEM_UPDATED', 'estimate', null, '5'), 'estimó en 5 pts'],
    ['estimación quitada', entrada('ITEM_UPDATED', 'estimate', '5', null), 'quitó la estimación'],
    [
      'fecha límite en UTC',
      entrada('ITEM_UPDATED', 'dueDate', null, '2026-10-12T00:00:00.000Z'),
      'cambió la fecha límite al 12-10-2026',
    ],
    [
      'fecha límite quitada',
      entrada('ITEM_UPDATED', 'dueDate', '2026-10-12T00:00:00.000Z', null),
      'quitó la fecha límite',
    ],
    [
      'responsable asignado (MIR-17)',
      entrada('ITEM_ASSIGNED', 'assigneeId', null, 'Diego'),
      'asignó a Diego',
    ],
    [
      'responsable quitado',
      entrada('ITEM_ASSIGNED', 'assigneeId', 'Diego', null),
      'quitó el responsable',
    ],
    ['comentario', entrada('COMMENT_ADDED', 'reference', null, 'MIR-12'), 'agregó un comentario'],
    [
      'campo desconocido',
      entrada('ITEM_UPDATED', 'sprintId', 'sprint_1', 'sprint_2'),
      'actualizó el ítem',
    ],
  ])('%s', (_, actividad, esperado) => {
    expect(describeActivity(actividad, 'item')).toBe(esperado);
  });
});

describe('describeActivity en el panel del proyecto (MIR-23)', () => {
  it.each([
    ['creación', entrada('ITEM_CREATED'), 'creó un ítem'],
    [
      'cambio de estado',
      entrada('ITEM_STATUS_CHANGED', 'status', 'TODO', 'IN_PROGRESS'),
      'movió un ítem de Por hacer a En progreso',
    ],
    [
      'prioridad',
      entrada('ITEM_UPDATED', 'priority', 'LOW', 'CRITICAL'),
      'cambió la prioridad de un ítem de Baja a Critica',
    ],
    ['estimación nueva', entrada('ITEM_UPDATED', 'estimate', null, '8'), 'estimó un ítem en 8 pts'],
    [
      'responsable',
      entrada('ITEM_UPDATED', 'assigneeId', 'Ada Lovelace', 'Alan Turing'),
      'asignó un ítem a Alan Turing',
    ],
    [
      'eliminación con referencia',
      entrada('ITEM_DELETED', 'reference', 'MIR-7', null),
      'eliminó el ítem MIR-7',
    ],
    [
      'comentario con referencia',
      entrada('COMMENT_ADDED', 'reference', null, 'MIR-12'),
      'agregó un comentario en MIR-12',
    ],
    [
      'miembro agregado',
      entrada('MEMBER_ADDED', 'member', null, 'Grace Hopper'),
      'agregó a Grace Hopper al proyecto',
    ],
    [
      'miembro agregado que ya no existe',
      entrada('MEMBER_ADDED', 'member', null, null),
      'agregó un miembro al proyecto',
    ],
    [
      'miembro quitado',
      entrada('MEMBER_REMOVED', 'member', 'Grace Hopper', null),
      'quitó a Grace Hopper del proyecto',
    ],
    [
      'rol',
      entrada('MEMBER_ROLE_CHANGED', 'role', 'MEMBER', 'VIEWER'),
      'cambió el rol de un miembro de Miembro a Observador',
    ],
    [
      'nombre del proyecto',
      entrada('PROJECT_UPDATED', 'name', 'Mira', 'Mira 2'),
      'cambió el nombre del proyecto de «Mira» a «Mira 2»',
    ],
    [
      'descripción del proyecto',
      entrada('PROJECT_UPDATED', 'description', null, 'Nueva'),
      'editó la descripción del proyecto',
    ],
    ['campo desconocido', entrada('ITEM_UPDATED', 'position', '1', '2'), 'actualizó un ítem'],
  ])('%s', (_, actividad, esperado) => {
    expect(describeActivity(actividad, 'project')).toBe(esperado);
  });
});

describe('describeActivity nunca filtra nombres de columnas ni valores crudos', () => {
  const casos = [
    entrada('ITEM_STATUS_CHANGED', 'status', 'IN_PROGRESS', 'IN_REVIEW'),
    entrada('ITEM_UPDATED', 'priority', 'HIGH', 'CRITICAL'),
    entrada('ITEM_UPDATED', 'dueDate', null, '2026-10-12T00:00:00.000Z'),
    entrada('ITEM_UPDATED', 'assigneeId', null, null),
    entrada('ITEM_UPDATED', 'estimate', null, null),
    entrada('ITEM_UPDATED', 'sprintId', 'a', 'b'),
    entrada('MEMBER_ROLE_CHANGED', 'role', 'OWNER', 'MEMBER'),
  ];
  const prohibidos =
    /IN_PROGRESS|IN_REVIEW|CRITICAL|OWNER|assigneeId|dueDate|sprintId|estimate|\d{4}-\d{2}-\d{2}T/;

  it.each(['item', 'project'] as ActivityContext[])('en contexto %s', (context) => {
    for (const caso of casos) {
      expect(describeActivity(caso, context)).not.toMatch(prohibidos);
    }
  });
});

it('no resuelve campos ni valores por el prototipo', () => {
  expect(describeActivity(entrada('ITEM_UPDATED', 'constructor', 'a', 'b'), 'item')).toBe(
    'actualizó el ítem',
  );
  expect(describeActivity(entrada('ITEM_UPDATED', 'priority', 'toString', 'HIGH'), 'item')).toBe(
    'cambió la prioridad de toString a Alta',
  );
});
