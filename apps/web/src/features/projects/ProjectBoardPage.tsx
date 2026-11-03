import { useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { can } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { KanbanBoard } from '@/features/board/KanbanBoard';
import { useBoard } from '@/features/board/useBoard';
import { useSprints } from '@/features/sprints/useSprints';
import { CreateWorkItemForm } from '@/features/work-items/CreateWorkItemForm';
import { useProject } from './useProjects';

/** MIR-47: que muestra el tablero cuando hay un sprint activo. */
type Vista = 'sprint' | 'todos';

/**
 * Pagina del tablero (MIR-18) con la creacion de elementos (MIR-30). Igual que
 * el backlog, el contenedor decide quien puede crear: KanbanBoard no conoce
 * rutas ni permisos de creacion.
 *
 * MIR-47: si el proyecto tiene un sprint activo, el tablero muestra por
 * defecto solo sus elementos; "Todos los elementos" vuelve a la vista de la
 * Entrega 1. Sin sprint activo no hay selector y el tablero no cambia.
 */
export function ProjectBoardPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const sprints = useSprints(projectId);
  const [creating, setCreating] = useState(false);
  const [vista, setVista] = useState<Vista>('sprint');
  const vistaId = useId();
  // Misma consulta (y cache) que KanbanBoard: no pide nada extra.
  const firstColumnId = useBoard(projectId).data?.columns[0]?.id ?? null;
  // Si el proyecto falla, KanbanBoard ya informa el error: solo se oculta el CTA.
  const canCreate = !project.isError && can(project.data?.myRole, 'work-item:create');

  const activo = sprints.data?.find((sprint) => sprint.status === 'ACTIVE') ?? null;
  const sprintVisible = activo && vista === 'sprint' ? activo : null;

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {activo ? (
          <div className="sm:w-72">
            <label htmlFor={vistaId} className="text-sm font-medium text-slate-700">
              Vista del tablero
            </label>
            <Select
              id={vistaId}
              className="mt-1"
              value={vista}
              onChange={(event) => setVista(event.target.value as Vista)}
            >
              <option value="sprint">Sprint activo: {activo.name}</option>
              <option value="todos">Todos los elementos</option>
            </Select>
          </div>
        ) : (
          <span />
        )}
        {canCreate && (
          <Button
            aria-expanded={creating}
            aria-controls="board-create-form"
            onClick={() => setCreating((current) => !current)}
          >
            {creating ? 'Cerrar formulario' : '+ Crear elemento'}
          </Button>
        )}
      </div>

      {creating && canCreate && (
        <div id="board-create-form" className="space-y-2">
          {sprintVisible ? (
            <p className="text-sm text-slate-600">
              Los elementos nuevos se crean sin sprint: no aparecerán en esta vista hasta asignarlos
              a «{sprintVisible.name}» desde su detalle. Elige «Todos los elementos» para verlos en
              el tablero.
            </p>
          ) : null}
          {/* Nace en la primera columna del proyecto: el backlog no se ve en
              el tablero. */}
          <CreateWorkItemForm
            key={projectId}
            projectId={projectId}
            initialColumnId={firstColumnId}
          />
        </div>
      )}

      {sprints.isPending ? (
        <p role="status" className="p-6 text-sm text-slate-500">
          Cargando tablero...
        </p>
      ) : (
        <>
          {sprints.isError ? (
            <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No se pudo cargar el sprint activo; se muestran todos los elementos.
            </p>
          ) : null}
          <KanbanBoard projectId={projectId} sprint={sprintVisible} />
        </>
      )}
    </main>
  );
}
