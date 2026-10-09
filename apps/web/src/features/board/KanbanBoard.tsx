import { BOARD_STATUSES, STATUS_LABELS, type WorkItemDto } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useBoard } from './useBoard';
import { WorkItemCard } from './WorkItemCard';

export interface KanbanBoardProps {
  projectId: string;
}

interface BoardColumnProps {
  status: (typeof BOARD_STATUSES)[number];
  items: WorkItemDto[];
}

/**
 * Columna del tablero.
 *
 * La lista se renderiza SIEMPRE, aunque este vacia, y con alto minimo: es el
 * destino al que MIR-19 (menu "Mover a...") y MIR-20 (arrastre) llevan las
 * tarjetas, asi que no puede desaparecer cuando se queda sin items.
 */
function BoardColumn({ status, items }: BoardColumnProps) {
  const label = STATUS_LABELS[status];
  const headingId = `columna-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-72 shrink-0 snap-start flex-col rounded-lg bg-slate-100 p-3"
    >
      <h3 id={headingId} className="flex items-center justify-between text-sm font-semibold">
        <span className="text-slate-800">{label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
          <span className="sr-only">Cantidad: </span>
          {items.length}
        </span>
      </h3>

      <div className="relative mt-3 flex flex-1">
        <ul
          aria-label={`Tarjetas de ${label}`}
          data-status={status}
          className={cn(
            'flex min-h-24 min-w-0 flex-1 flex-col gap-2 rounded-md',
            items.length === 0 && 'border-2 border-dashed border-slate-300',
          )}
        >
          {items.map((item) => (
            <WorkItemCard key={item.id} item={item} />
          ))}
        </ul>
        {items.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Sin elementos
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Tablero Kanban reutilizable: su contenedor entrega el proyecto, por lo que
 * este componente no necesita conocer rutas.
 *
 * Las columnas salen de BOARD_STATUSES (el orden del arreglo es el orden en
 * pantalla), no de los items recibidos: asi una columna vacia existe igual.
 */
export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const board = useBoard(projectId);

  if (board.isPending) {
    return (
      <p role="status" className="p-6 text-sm text-slate-500">
        Cargando tablero...
      </p>
    );
  }

  if (board.isError) {
    const message =
      board.error instanceof ApiRequestError
        ? board.error.message
        : 'No se pudo cargar el tablero. Intentalo nuevamente.';

    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {message}
      </p>
    );
  }

  const items = board.data;

  return (
    <section aria-labelledby="tablero-titulo" className="min-w-0">
      <h2 id="tablero-titulo" className="text-xl font-semibold text-slate-900">
        Tablero
      </h2>

      {/* Region enfocable: en 375 px las columnas se desplazan dentro de ella
          (tambien con teclado) sin ensanchar la pagina. `relative` es
          necesario: sin el, los textos sr-only (absolutos) de las columnas
          fuera de vista se posicionan contra el documento y lo ensanchan. */}
      <div
        role="region"
        aria-label="Columnas del tablero"
        tabIndex={0}
        className="relative mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-slate-400"
      >
        {BOARD_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            items={items.filter((item) => item.status === status)}
          />
        ))}
      </div>
    </section>
  );
}
