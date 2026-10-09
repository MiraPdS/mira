import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  type WorkItemDto,
  type WorkItemPriority,
  type WorkItemStatus,
} from '@mira/shared';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { CardDragData } from './boardDnd';
import { MoveToMenu } from './MoveToMenu';

const PRIORITY_STYLES: Record<WorkItemPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HIGH: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export interface WorkItemCardProps {
  item: WorkItemDto;
  /**
   * Presente solo si el usuario puede cambiar estados: sin el, la tarjeta no
   * ofrece el menu "Mover a..." ni se puede arrastrar (VIEWER, o rol aun
   * desconocido).
   */
  onMove?: (status: WorkItemStatus) => void;
}

/**
 * Tarjeta del tablero: referencia, titulo, tipo, prioridad y responsable.
 *
 * Arrastre (MIR-20): con raton se toma desde cualquier punto de la tarjeta;
 * con teclado, desde el asa "Arrastrar MIR-n" (dnd-kit solo activa el
 * KeyboardSensor desde el nodo activador, asi que Enter en "Mover a..." sigue
 * abriendo el menu). En pantallas tactiles solo el asa bloquea el gesto del
 * navegador (`touch-none`): el resto de la tarjeta deja desplazar el tablero.
 */
export function WorkItemCard({ item, onMove }: WorkItemCardProps) {
  const titleId = `tarjeta-${item.id}-titulo`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      data: { item } satisfies CardDragData,
      disabled: !onMove,
    });

  return (
    <li
      ref={setNodeRef}
      // Sobre las columnas siguientes, que estan posicionadas (`relative`).
      className={cn(isDragging && 'relative z-20')}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <article
        aria-labelledby={titleId}
        {...listeners}
        className={cn(
          'rounded-md border border-slate-200 bg-white p-3 shadow-sm',
          onMove && 'cursor-grab',
          isDragging && 'cursor-grabbing shadow-lg ring-2 ring-sky-400',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {onMove ? (
              <button
                ref={setActivatorNodeRef}
                type="button"
                {...attributes}
                aria-label={`Arrastrar ${item.reference}`}
                className="-ml-1 touch-none rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-slate-400"
              >
                <span aria-hidden="true">⠿</span>
              </button>
            ) : null}
            <p className="min-w-0 font-mono text-xs text-slate-500">{item.reference}</p>
          </div>
          {onMove ? (
            <MoveToMenu reference={item.reference} currentStatus={item.status} onMove={onMove} />
          ) : null}
        </div>
        <h4 id={titleId} className="mt-1 text-sm font-medium wrap-anywhere text-slate-900">
          {item.title}
        </h4>

        <dl className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <div className="flex gap-1">
            <dt className="sr-only">Tipo</dt>
            <dd>{TYPE_LABELS[item.type]}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="sr-only">Prioridad</dt>
            <dd className={cn('rounded px-1.5 py-0.5 font-medium', PRIORITY_STYLES[item.priority])}>
              {PRIORITY_LABELS[item.priority]}
            </dd>
          </div>
          <div className="flex min-w-0 basis-full gap-1">
            <dt className="sr-only">Responsable</dt>
            <dd className={cn('truncate', !item.assignee && 'italic text-slate-400')}>
              {item.assignee?.name ?? 'Sin asignar'}
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
