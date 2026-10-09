import { Link } from 'react-router-dom';
import { ROLE_LABELS, type ProjectDto } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { useProjects } from './useProjects';

/** Ruta del formulario de creacion. Mientras no exista, es un marcador (MIR-5). */
const NUEVO_PROYECTO = '/proyectos/nuevo';

/**
 * Pantalla "Mis proyectos" (MIR-6).
 *
 * Muestra solo los proyectos donde el usuario es miembro; ese filtro lo hace
 * la API, no esta pagina.
 */
export function ProjectsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Mis proyectos</h1>
        {/* Siempre visible: crear no depende de que la lista haya cargado. */}
        <Link
          to={NUEVO_PROYECTO}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
        >
          Nuevo proyecto
        </Link>
      </div>
      <ContenidoProyectos />
    </main>
  );
}

function ContenidoProyectos() {
  const { data: projects, isPending, isError, refetch, isFetching } = useProjects();

  if (isPending) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Cargando proyectos...
      </p>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-red-700">
          No se pudieron cargar tus proyectos.
        </p>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? 'Reintentando...' : 'Reintentar'}
        </Button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
        <p className="text-sm text-slate-600">Aun no participas en ningun proyecto.</p>
        <Link
          to={NUEVO_PROYECTO}
          className="mt-2 inline-block text-sm font-medium text-slate-900 underline"
        >
          Crea tu primer proyecto
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </ul>
  );
}

function ProjectCard({ project }: { project: ProjectDto }) {
  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link
            to={`/proyectos/${encodeURIComponent(project.id)}`}
            className="truncate font-medium text-slate-900 hover:underline"
          >
            {project.name}
          </Link>
          <span className="font-mono text-xs text-slate-500">{project.key}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to={`/proyectos/${encodeURIComponent(project.id)}/configuracion`}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
            aria-label={`Configuracion de ${project.name}`}
          >
            Configuracion
          </Link>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {ROLE_LABELS[project.myRole]}
          </span>
          {/* MIR-18: cualquier miembro (incluido VIEWER) puede ver el tablero. */}
          <Link
            to={`/proyectos/${encodeURIComponent(project.id)}/tablero`}
            aria-label={`Ver tablero de ${project.name}`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
          >
            Ver tablero
          </Link>
        </div>
      </div>
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.description}</p>
      )}
    </li>
  );
}
