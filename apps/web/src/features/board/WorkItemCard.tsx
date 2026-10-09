import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  type WorkItemDto,
  type WorkItemPriority,
  type WorkItemStatus,
} from '@mira/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
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
        <ContenidoTarjeta
          item={item}
          titleId={titleId}
          asa={
            onMove ? (
              <button
                ref={setActivatorNodeRef}
                type="button"
                {...attributes}
                data-asa-arrastre=""
                aria-label={`Arrastrar ${item.reference}`}
                className={cn(CLASES_ASA, 'hover:bg-slate-100 hover:text-slate-600')}
              >
                <span aria-hidden="true">⠿</span>
              </button>
            ) : null
          }
          menu={
            onMove ? (
              <MoveToMenu reference={item.reference} currentStatus={item.status} onMove={onMove} />
            ) : null
          }
        />
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
      <ContenidoTarjeta item={item} asa={<span className={CLASES_ASA}>⠿</span>} />
    </article>
  );
}

/**
 * Cuerpo comun de WorkItemCard y TarjetaArrastrada: cada una aporta su asa y,
 * la original, el menu. Asi la tarjeta no cambia de aspecto al tomarla.
 */
function ContenidoTarjeta({
  item,
  titleId,
  asa,
  menu,
}: {
  item: WorkItemDto;
  titleId?: string;
  asa: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {asa}
          <p className="min-w-0 font-mono text-xs text-slate-500">{item.reference}</p>
        </div>
        {menu}
      </div>
      <h4 id={titleId} className="mt-1 text-sm font-medium wrap-anywhere text-slate-900">
        {/* Solo la tarjeta real enlaza al detalle; la copia que sigue al
            puntero es imagen.  draggable=false: el arrastre nativo de un
            enlace competiria con el de dnd-kit (que exige 5 px, asi que un
            clic sigue siendo un clic). */}
        {titleId ? (
          <Link
            to={`/proyectos/${encodeURIComponent(item.projectId)}/elementos/${encodeURIComponent(item.id)}`}
            draggable={false}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-slate-400"
          >
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </h4>
      <DatosTarjeta item={item} />
    </>
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
