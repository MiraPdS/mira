import type { BoardColumnDto, WorkItemDto } from '@mira/shared';

/**
 * MIR-49: columnas de un proyecto recien creado (las de DEFAULT_BOARD_COLUMNS)
 * con ids fijos, para los datos de prueba de la web.
 */
export const COLUMNAS_DE_PRUEBA: BoardColumnDto[] = [
  { id: 'col_todo', name: 'Por hacer', position: 0, category: 'TODO' },
  { id: 'col_doing', name: 'En progreso', position: 1, category: 'IN_PROGRESS' },
  { id: 'col_review', name: 'En revision', position: 2, category: 'IN_PROGRESS' },
  { id: 'col_done', name: 'Hecho', position: 3, category: 'DONE' },
];

/**
 * Atajo de las pruebas: los estados de la Entrega 1 nombran las columnas por
 * defecto, en su orden. BACKLOG es no tener columna.
 */
export type EstadoDePrueba = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

const INDICE: Record<Exclude<EstadoDePrueba, 'BACKLOG'>, number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  IN_REVIEW: 2,
  DONE: 3,
};

/** Columna por defecto que equivale a un estado de prueba. */
export function columnaDe(status: Exclude<EstadoDePrueba, 'BACKLOG'>): BoardColumnDto {
  return COLUMNAS_DE_PRUEBA[INDICE[status]]!;
}

/** Campos de un item que lo ubican en la columna de un estado (o en el backlog). */
export function enColumna(status: EstadoDePrueba): Pick<WorkItemDto, 'columnId' | 'column'> {
  if (status === 'BACKLOG') return { columnId: null, column: null };
  const column = columnaDe(status);
  return { columnId: column.id, column };
}
