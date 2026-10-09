import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  type WorkItemDto,
  type WorkItemPriority,
  type WorkItemStatus,
} from '@mira/shared';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { ATRIBUTO_ASA, type CardDragData } from './boardDnd';
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
 * abriendo el menu). En pantallas tactiles solo el asa arrastra (ver
 * SensorTactilDesdeAsa) y bloquea el gesto del navegador (`touch-none`): el
 * resto de la tarjeta deja desplazar el tablero.
 *
 * MIR-24: bajo `sm` el asa y "Mover a..." miden 44 px; los margenes negativos
 * compensan ese tamano para que la tarjeta no crezca. Mientras se arrastra,
 * la tarjeta se queda en su lugar como hueco atenuado y lo que sigue al dedo
 * es TarjetaArrastrada, dentro del DragOverlay del tablero.
 */
export function WorkItemCard({ item, onMove }: WorkItemCardProps) {
  const titleId = `tarjeta-${item.id}-titulo`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item } satisfies CardDragData,
    disabled: !onMove,
  });

  return (
    <li ref={setNodeRef}>
      <article
        aria-labelledby={titleId}
        {...listeners}
        className={cn(
          'rounded-md border border-slate-200 bg-white p-3 shadow-sm',
          onMove && 'cursor-grab',
          isDragging && 'opacity-40',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {onMove ? (
              <button
                ref={setActivatorNodeRef}
                type="button"
                {...attributes}
                {...{ [ATRIBUTO_ASA]: '' }}
                aria-label={`Arrastrar ${item.reference}`}
                className={cn(CLASES_ASA, 'hover:bg-slate-100 hover:text-slate-600')}
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
        <DatosTarjeta item={item} />
      </article>
    </li>
  );
}

const CLASES_ASA =
  '-my-2 -ml-3 flex size-11 touch-none items-center justify-center rounded text-slate-400 focus-visible:outline-2 focus-visible:outline-slate-400 sm:my-0 sm:-ml-1 sm:size-auto sm:px-1';

/**
 * Copia visual de la tarjeta que sigue al puntero durante el arrastre.
 *
 * Vive en el DragOverlay, fuera de la region desplazable: una tarjeta movida
 * con `transform` dentro de ella agrandaba su area de desplazamiento y el
 * auto-scroll seguia de largo mas alla de la ultima columna. Es solo imagen
 * (aria-hidden): el foco y los anuncios siguen en la tarjeta original.
 */
export function TarjetaArrastrada({ item }: { item: WorkItemDto }) {
  return (
    <article
      aria-hidden="true"
      className="cursor-grabbing rounded-md border border-slate-200 bg-white p-3 shadow-lg ring-2 ring-sky-400"
    >
      <div className="flex min-w-0 items-center gap-1">
        <span className={CLASES_ASA}>⠿</span>
        <p className="min-w-0 font-mono text-xs text-slate-500">{item.reference}</p>
      </div>
      <p className="mt-1 text-sm font-medium wrap-anywhere text-slate-900">{item.title}</p>
      <DatosTarjeta item={item} />
    </article>
  );
}

function DatosTarjeta({ item }: { item: WorkItemDto }) {
  return (
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
  );
}
