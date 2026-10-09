import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { can } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { CreateWorkItemForm } from '@/features/work-items/CreateWorkItemForm';
import { WorkItemBacklog } from '@/features/work-items/WorkItemBacklog';
import { useProject } from './useProjects';

/** Integra los componentes reutilizables de MIR-11/MIR-12 en la navegacion. */
export function ProjectBacklogPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const [creating, setCreating] = useState(false);
  const canCreate = can(project.data?.myRole, 'work-item:create');
  // 403 y 404 no se resuelven reintentando: se informan sin ofrecer reintento.
  const errorStatus = project.error?.status;
  const permanentError = errorStatus === 403 || errorStatus === 404;
  const errorMessage =
    errorStatus === 403
      ? 'No tienes acceso a este proyecto.'
      : errorStatus === 404
        ? 'El proyecto no existe.'
        : 'No se pudo cargar el proyecto.';

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        to={`/proyectos/${projectId}`}
        className="inline-flex min-h-11 items-center text-sm text-blue-600 hover:underline sm:min-h-0"
      >
        ← Volver al proyecto
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Backlog</h1>
        {!project.isError && canCreate && (
          <Button
            aria-expanded={creating}
            aria-controls="backlog-create-form"
            onClick={() => setCreating((current) => !current)}
          >
            {creating ? 'Cerrar formulario' : '+ Crear elemento'}
          </Button>
        )}
      </header>

      {project.isPending ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando proyecto...
        </p>
      ) : project.isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
          {!permanentError && (
            <Button variant="secondary" onClick={() => void project.refetch()}>
              Reintentar
            </Button>
          )}
        </div>
      ) : (
        <>
          {creating && canCreate && (
            <div id="backlog-create-form">
              <CreateWorkItemForm key={projectId} projectId={projectId} />
            </div>
          )}
          <WorkItemBacklog key={projectId} projectId={projectId} showTitle={false} />
        </>
      )}
    </main>
  );
}
