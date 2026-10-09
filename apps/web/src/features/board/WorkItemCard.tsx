import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  type WorkItemDto,
  type WorkItemPriority,
  type WorkItemStatus,
} from '@mira/shared';
import { cn } from '@/lib/utils';
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
   * ofrece el menu "Mover a..." (VIEWER, o rol aun desconocido).
   */
  onMove?: (status: WorkItemStatus) => void;
}

/** Tarjeta del tablero: referencia, titulo, tipo, prioridad y responsable. */
export function WorkItemCard({ item, onMove }: WorkItemCardProps) {
  const titleId = `tarjeta-${item.id}-titulo`;

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-mono text-xs text-slate-500">{item.reference}</p>
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
