import { Link, useParams } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/useAuth';
import { InviteMemberForm } from './InviteMemberForm';
import { ProjectMembers } from './ProjectMembers';
import { useProjectMembers } from './useProjects';
import { can } from '@mira/shared';

export function ProjectMembersPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: currentUser, isPending: loadingUser } = useCurrentUser();

  const {
    data: membersData,
    isPending: loadingMembers,
    isError: membersError,
  } = useProjectMembers(projectId ?? '');

  if (!projectId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p role="alert">No se encontro el proyecto.</p>
      </main>
    );
  }

  const currentMember = membersData?.members.find((member) => member.user.id === currentUser?.id);

  const canInvite = can(currentMember?.role, 'member:invite');

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div>
        <Link to="/proyectos" className="text-sm text-slate-600 underline">
          Volver a proyectos
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Equipo del proyecto</h1>
      </div>

      {!loadingUser && !loadingMembers && !membersError && canInvite && (
        <InviteMemberForm projectId={projectId} />
      )}

      <ProjectMembers projectId={projectId} />
    </main>
  );
}
