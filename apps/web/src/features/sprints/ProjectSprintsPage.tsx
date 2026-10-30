import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { can, SPRINT_STATUS_LABELS, type SprintListItemDto, type SprintStatus } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { useProject } from '@/features/projects/useProjects';
import { SprintForm } from './SprintForm';
import { useSprints } from './useSprints';

/** Titulo de cada grupo, en el orden de la pantalla. */
const SECCIONES: { status: SprintStatus; titulo: string }[] = [
  { status: 'ACTIVE', titulo: 'Sprint activo' },
  { status: 'PLANNED', titulo: 'Planificados' },
  { status: 'CLOSED', titulo: 'Cerrados' },
];

/** Las fechas del sprint son dias de calendario: se leen en UTC para no correrse. */
const calendarDate = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'UTC' });
const fechaCalendario = (date: string) => calendarDate.format(new Date(`${date}T00:00:00Z`));

/** `null`: nada abierto; `'nuevo'`: creando; otro valor: id del sprint en edicion. */
type Edicion = null | 'nuevo' | string;

/** MIR-44: ver y administrar los sprints del proyecto. */
export function ProjectSprintsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const sprints = useSprints(projectId);
  const [edicion, setEdicion] = useState<Edicion>(null);

  const rol = project.data?.myRole;
  const puedeCrear = can(rol, 'sprint:create');
  const puedeEditar = can(rol, 'sprint:update');

  // 403 y 404 no se resuelven reintentando: se informan sin ofrecer reintento.
  const errorStatus = project.error?.status;
  const errorPermanente = errorStatus === 403 || errorStatus === 404;
  const errorProyecto =
    errorStatus === 403
      ? 'No tienes acceso a este proyecto.'
      : errorStatus === 404
        ? 'El proyecto no existe.'
        : 'No se pudo cargar el proyecto.';

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        to={`/proyectos/${projectId}`}
        className="inline-flex min-h-11 items-center text-sm text-blue-600 hover:underline sm:min-h-0"
      >
        ← Volver al proyecto
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Sprints</h1>
        {project.isSuccess && puedeCrear && edicion !== 'nuevo' && (
          <Button onClick={() => setEdicion('nuevo')}>+ Crear sprint</Button>
        )}
      </header>

      {project.isPending ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando proyecto...
        </p>
      ) : project.isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-red-700">{errorProyecto}</p>
          {!errorPermanente && (
            <Button variant="secondary" onClick={() => void project.refetch()}>
              Reintentar
            </Button>
          )}
        </div>
      ) : (
        <>
          {edicion === 'nuevo' && puedeCrear && (
            <SprintForm
              projectId={projectId}
              onSaved={() => setEdicion(null)}
              onCancel={() => setEdicion(null)}
            />
          )}

          {sprints.isPending ? (
            <p role="status" className="text-sm text-slate-500">
              Cargando sprints...
            </p>
          ) : sprints.isError ? (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-red-700">No se pudieron cargar los sprints.</p>
              <Button variant="secondary" onClick={() => void sprints.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : sprints.data.length === 0 ? (
            <p className="text-sm text-slate-500">
              {puedeCrear
                ? 'Aun no hay sprints. Crea el primero para planificar el trabajo.'
                : 'Aun no hay sprints en este proyecto.'}
            </p>
          ) : (
            SECCIONES.map(({ status, titulo }) => {
              const grupo = sprints.data.filter((sprint) => sprint.status === status);
              if (grupo.length === 0) return null;
              return (
                <section key={status} aria-labelledby={`sprints-${status}`} className="space-y-3">
                  <h2 id={`sprints-${status}`} className="text-lg font-semibold text-slate-900">
                    {titulo}
                  </h2>
                  <ul className="space-y-3">
                    {grupo.map((sprint) => (
                      <li key={sprint.id}>
                        {edicion === sprint.id && puedeEditar ? (
                          <SprintForm
                            projectId={projectId}
                            sprint={sprint}
                            onSaved={() => setEdicion(null)}
                            onCancel={() => setEdicion(null)}
                          />
                        ) : (
                          <SprintCard
                            sprint={sprint}
                            onEdit={puedeEditar ? () => setEdicion(sprint.id) : undefined}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}
    </main>
  );
}

function SprintCard({ sprint, onEdit }: { sprint: SprintListItemDto; onEdit?: () => void }) {
  return (
    <article
      aria-labelledby={`sprint-${sprint.id}`}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <h3 id={`sprint-${sprint.id}`} className="font-semibold wrap-anywhere text-slate-900">
          {sprint.name}
        </h3>
        <p className="text-sm text-slate-600">
          {SPRINT_STATUS_LABELS[sprint.status]} · {fechaCalendario(sprint.startDate)} –{' '}
          {fechaCalendario(sprint.endDate)}
        </p>
        {sprint.goal ? <p className="text-sm wrap-anywhere text-slate-700">{sprint.goal}</p> : null}
        <p className="text-sm text-slate-500">
          {sprint.items} {sprint.items === 1 ? 'elemento' : 'elementos'} · {sprint.points}{' '}
          {sprint.points === 1 ? 'punto' : 'puntos'}
        </p>
      </div>
      {onEdit ? (
        <Button variant="secondary" aria-label={`Editar ${sprint.name}`} onClick={onEdit}>
          Editar
        </Button>
      ) : null}
    </article>
  );
}
