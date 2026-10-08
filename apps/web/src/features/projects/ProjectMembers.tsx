import { useState } from 'react';
import { can } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { useChangeMemberRole, useProjectMembers, useRemoveMember } from './useProjects';
import type { ProjectMemberRole } from './project.api';

interface ProjectMembersProps {
  projectId: string;
  currentUserId?: string;
}

export function ProjectMembers({ projectId, currentUserId }: ProjectMembersProps) {
  const { data, isPending, isError, error } = useProjectMembers(projectId);

  const changeRole = useChangeMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);

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
  const currentMember = members.find((member) => member.user.id === currentUserId);

  const canChangeRole = can(currentMember?.role, 'member:change-role');
  const canRemoveMember = can(currentMember?.role, 'member:remove');

  async function handleRoleChange(userId: string, role: ProjectMemberRole) {
    setActionError(null);

    try {
      await changeRole.mutateAsync({ userId, role });
    } catch (error) {
      setActionError(
        error instanceof ApiRequestError ? error.message : 'No se pudo cambiar el rol del miembro.',
      );
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return;

    setActionError(null);

    try {
      await removeMember.mutateAsync(memberToRemove.userId);
      setMemberToRemove(null);
    } catch (error) {
      setActionError(
        error instanceof ApiRequestError ? error.message : 'No se pudo quitar al miembro.',
      );
    }
  }

  const isUpdating = changeRole.isPending || removeMember.isPending;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Miembros del proyecto</h2>

      {actionError && (
        <p role="alert" className="text-sm text-red-700">
          {actionError}
        </p>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-slate-500">Este proyecto no tiene miembros.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {members.map((member) => {
            const isOwner = member.role === 'OWNER';
            const canManageRole = canChangeRole && !isOwner;
            const canDelete = canRemoveMember && !isOwner;

            return (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-slate-900">{member.user.name}</p>
                  <p className="text-sm text-slate-500">{member.user.email}</p>
                </div>

                <div className="flex items-center gap-3">
                  {canManageRole ? (
                    <select
                      aria-label={`Rol de ${member.user.name}`}
                      value={member.role}
                      disabled={isUpdating}
                      onChange={(event) => {
                        void handleRoleChange(
                          member.user.id,
                          event.target.value as ProjectMemberRole,
                        );
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {member.role}
                    </span>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        setMemberToRemove({
                          userId: member.user.id,
                          name: member.user.name,
                        })
                      }
                      className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {memberToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
          className="rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <h3 id="remove-member-title" className="font-semibold text-slate-900">
            Confirmar eliminación
          </h3>

          <p className="mt-2 text-sm text-slate-700">
            ¿Quieres quitar a {memberToRemove.name} del proyecto? Sus tareas asignadas quedarán sin
            responsable, pero no se eliminarán.
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => setMemberToRemove(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void handleRemoveMember()}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {removeMember.isPending ? 'Quitando...' : 'Confirmar eliminación'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
