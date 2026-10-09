import {
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type ActivityDto,
} from '@mira/shared';

/**
 * Donde se muestra la actividad.
 * - `item`: historial de un elemento (MIR-22); el ítem se sobreentiende.
 * - `project`: panel del proyecto (MIR-23); se habla de "un ítem".
 */
export type ActivityContext = 'item' | 'project';

type ActivityInput = Pick<ActivityDto, 'action' | 'field' | 'fromValue' | 'toValue'>;

/** Campos con valor de enum y el sustantivo con su articulo. */
const ENUM_FIELDS: Record<string, { noun: string; labels: Record<string, string> }> = {
  status: { noun: 'el estado', labels: STATUS_LABELS },
  type: { noun: 'el tipo', labels: TYPE_LABELS },
  priority: { noun: 'la prioridad', labels: PRIORITY_LABELS },
};

function label(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/** Fecha limite como dia calendario: se lee en UTC para que no se corra un dia. */
function formatDueDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CL', { timeZone: 'UTC' });
}

function points(value: string): string {
  return `${value} pts`;
}

/**
 * Frase en lenguaje natural para una entrada de la bitacora, SIN el actor (la
 * UI antepone el nombre).  Nunca devuelve nombres de columnas ni valores
 * crudos de enums: un campo desconocido cae en una frase generica.
 */
export function describeActivity(activity: ActivityInput, context: ActivityContext): string {
  const { action, field, fromValue, toValue } = activity;
  const inProject = context === 'project';
  // "de un ítem" solo en el panel; en el historial el ítem se sobreentiende.
  const ofItem = inProject ? ' de un ítem' : '';
  const genericUpdate = inProject ? 'actualizó un ítem' : 'actualizó el ítem';

  switch (action) {
    case 'ITEM_CREATED':
      return inProject ? 'creó un ítem' : 'creó el ítem';

    case 'ITEM_DELETED':
      return inProject && fromValue ? `eliminó el ítem ${fromValue}` : 'eliminó el ítem';

    case 'COMMENT_ADDED':
      return inProject && toValue ? `agregó un comentario en ${toValue}` : 'agregó un comentario';

    case 'ITEM_STATUS_CHANGED':
      if (fromValue && toValue) {
        const target = inProject ? ' un ítem' : '';
        return `movió${target} de ${label(STATUS_LABELS, fromValue)} a ${label(STATUS_LABELS, toValue)}`;
      }
      return genericUpdate;

    case 'ITEM_ASSIGNED':
    case 'ITEM_UPDATED':
      return describeItemField(field, fromValue, toValue, ofItem, inProject) ?? genericUpdate;

    case 'MEMBER_ADDED':
      return toValue ? `agregó a ${toValue} al proyecto` : 'agregó un miembro al proyecto';

    case 'MEMBER_REMOVED':
      return fromValue ? `quitó a ${fromValue} del proyecto` : 'quitó un miembro del proyecto';

    case 'MEMBER_ROLE_CHANGED':
      if (fromValue && toValue) {
        return `cambió el rol de un miembro de ${label(ROLE_LABELS, fromValue)} a ${label(ROLE_LABELS, toValue)}`;
      }
      return 'cambió el rol de un miembro';

    case 'PROJECT_UPDATED':
      if (field === 'name' && fromValue && toValue) {
        return `cambió el nombre del proyecto de «${fromValue}» a «${toValue}»`;
      }
      if (field === 'description') return 'editó la descripción del proyecto';
      return 'actualizó el proyecto';
  }
}

function describeItemField(
  field: string | null,
  fromValue: string | null,
  toValue: string | null,
  ofItem: string,
  inProject: boolean,
): string | null {
  if (field && field in ENUM_FIELDS) {
    const { noun, labels } = ENUM_FIELDS[field]!;
    if (fromValue && toValue) {
      return `cambió ${noun}${ofItem} de ${label(labels, fromValue)} a ${label(labels, toValue)}`;
    }
    return null;
  }

  switch (field) {
    case 'title':
      if (fromValue && toValue) return `cambió el título${ofItem} de «${fromValue}» a «${toValue}»`;
      return toValue ? `cambió el título${ofItem} a «${toValue}»` : null;

    case 'description':
      return `editó la descripción${ofItem}`;

    case 'estimate':
      if (fromValue && toValue) {
        return `cambió la estimación${ofItem} de ${fromValue} a ${points(toValue)}`;
      }
      if (toValue)
        return inProject ? `estimó un ítem en ${points(toValue)}` : `estimó en ${points(toValue)}`;
      return `quitó la estimación${ofItem}`;

    case 'dueDate':
      if (toValue) return `cambió la fecha límite${ofItem} al ${formatDueDate(toValue)}`;
      return `quitó la fecha límite${ofItem}`;

    case 'assigneeId':
      if (toValue) return inProject ? `asignó un ítem a ${toValue}` : `asignó a ${toValue}`;
      return `quitó el responsable${ofItem}`;

    default:
      return null;
  }
}
