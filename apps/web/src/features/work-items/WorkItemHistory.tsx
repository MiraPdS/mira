import { useId } from 'react';
import { ACTIVITY_LIST_LIMIT } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { describeActivity } from '@/features/activity/describeActivity';
import { ApiRequestError } from '@/lib/api-client';
import { fechaLegible } from '@/lib/dates';
import { useWorkItemActivity } from './useWorkItems';

export interface WorkItemHistoryProps {
  projectId: string;
  workItemId: string;
}

/** MIR-22: historial de cambios del elemento, del mas reciente al mas antiguo. */
export function WorkItemHistory({ projectId, workItemId }: WorkItemHistoryProps) {
  const titleId = useId();
  const { data, isPending, error, refetch } = useWorkItemActivity(projectId, workItemId);
  // 404 (elemento eliminado) y 403 (sin acceso) no se arreglan reintentando.
  const errorStatus = error instanceof ApiRequestError ? error.status : null;
  const unavailable = errorStatus === 403 || errorStatus === 404;

  return (
    <section aria-labelledby={titleId} className="mt-8 border-t border-slate-200 pt-6">
      <h3 id={titleId} className="text-lg font-semibold text-slate-900">
        Historial
      </h3>

      {isPending ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Cargando historial...
        </p>
      ) : unavailable ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {errorStatus === 404
            ? 'Este elemento ya no existe.'
            : 'No tienes acceso al historial de este elemento.'}
        </p>
      ) : error ? (
        <div className="mt-4">
          <p role="alert" className="text-sm text-red-700">
            No se pudo cargar el historial.
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Todavía no hay cambios registrados.</p>
      ) : (
        <>
          <ol className="mt-4 divide-y divide-slate-100">
            {data.data.map((activity) => (
              <li key={activity.id} className="py-3">
                <p className="text-sm wrap-anywhere text-slate-700">
                  <span className="font-semibold text-slate-900">{activity.actor.name}</span>{' '}
                  {describeActivity(activity, 'item')}
                </p>
                <time dateTime={activity.createdAt} className="mt-1 block text-xs text-slate-500">
                  {fechaLegible(activity.createdAt)}
                </time>
              </li>
            ))}
          </ol>
          {data.truncated && (
            <p className="mt-3 text-xs text-slate-500">
              Mostrando los {ACTIVITY_LIST_LIMIT} cambios más recientes.
            </p>
          )}
        </>
      )}
    </section>
  );
}
