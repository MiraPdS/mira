import { useProjectMembers } from './useProjects';
import { ApiRequestError } from '@/lib/api-client';

interface ProjectMembersProps {
  projectId: string;
}

export function ProjectMembers({ projectId }: ProjectMembersProps) {
  const { data, isPending, isError, error } = useProjectMembers(projectId);

  if (isPending) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Cargando miembros...
      </p>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiRequestError ? error.message : 'No se pudo cargar la lista de miembros.';

    return (
      <p role="alert" className="text-sm text-red-700">
        {message}
      </p>
    );
  }

  const members = data.members;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Miembros del proyecto</h2>

      {members.length === 0 ? (
        <p className="text-sm text-slate-500">Este proyecto no tiene miembros.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-slate-900">{member.user.name}</p>
                <p className="text-sm text-slate-500">{member.user.email}</p>
              </div>

              <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
