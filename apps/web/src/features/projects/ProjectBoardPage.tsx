import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BOARD_STATUSES, can } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { KanbanBoard } from '@/features/board/KanbanBoard';
import { CreateWorkItemForm } from '@/features/work-items/CreateWorkItemForm';
import { useProject } from './useProjects';

/**
 * Pagina del tablero (MIR-18) con la creacion de elementos (MIR-30). Igual que
 * el backlog, el contenedor decide quien puede crear: KanbanBoard no conoce
 * rutas ni permisos de creacion.
 */
export function ProjectBoardPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const [creating, setCreating] = useState(false);
  // Si el proyecto falla, KanbanBoard ya informa el error: solo se oculta el CTA.
  const canCreate = !project.isError && can(project.data?.myRole, 'work-item:create');

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-4 py-6 sm:px-6">
      {canCreate && (
        <div className="flex justify-end">
          <Button
            aria-expanded={creating}
            aria-controls="board-create-form"
            onClick={() => setCreating((current) => !current)}
          >
            {creating ? 'Cerrar formulario' : '+ Crear elemento'}
          </Button>
        </div>
      )}

      {creating && canCreate && (
        <div id="board-create-form">
          {/* Nace en la primera columna: BACKLOG no se ve en el tablero. */}
          <CreateWorkItemForm
            key={projectId}
            projectId={projectId}
            initialStatus={BOARD_STATUSES[0]}
          />
        </div>
      )}

      <KanbanBoard projectId={projectId} />
    </main>
  );
}
