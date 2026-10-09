import { useEffect, useRef, useState } from 'react';
import { can } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { Select } from '@/components/ui/select';
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

  const dialogRef = useRef<HTMLDialogElement>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const isUpdating = changeRole.isPending || removeMember.isPending;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (memberToRemove) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [memberToRemove]);

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

  // Solo el ultimo OWNER debe quedar protegido.
  const ownerCount = members.filter((member) => member.role === 'OWNER').length;

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

    setRemoveError(null);

    try {
      await removeMember.mutateAsync(memberToRemove.userId);

      // Cerrar el dialogo solamente cuando la eliminacion sea exitosa.
      setMemberToRemove(null);
    } catch (error) {
      // Mostrar el error dentro del dialogo y permitir reintentar.
      setRemoveError(
        error instanceof ApiRequestError ? error.message : 'No se pudo quitar al miembro.',
      );
    }
  }

  function handleCancelRemove() {
    if (isUpdating) return;

    setRemoveError(null);
    setMemberToRemove(null);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Miembros del proyecto</h2>

      {/* Errores relacionados con cambios de rol. */}
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

            // Un OWNER solo esta protegido si es el ultimo.
            const isLastOwner = isOwner && ownerCount <= 1;

            const canManageRole = canChangeRole && !isLastOwner;
            const canDelete = canRemoveMember && !isLastOwner;

            return (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                {/* MIR-24: min-w-0 + wrap-anywhere para que un nombre o correo
                    largo se parta en vez de ensanchar la pagina en movil. */}
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium wrap-anywhere text-slate-900">{member.user.name}</p>

                  <p className="text-sm wrap-anywhere text-slate-500">{member.user.email}</p>
                </div>

                <div className="flex items-center gap-3">
                  {canManageRole ? (
                    <Select
                      aria-label={`Rol de ${member.user.name}`}
                      value={member.role}
                      disabled={isUpdating}
                      onChange={(event) => {
                        void handleRoleChange(
                          member.user.id,
                          event.target.value as ProjectMemberRole,
                        );
                      }}
                      className="w-auto text-slate-700 sm:h-auto"
                    >
                      {/* OWNER no es un rol asignable desde la interfaz.
                          Si el miembro ya es OWNER, conservamos su opcion
                          para representar correctamente su estado actual. */}
                      {isOwner && (
                        <option value="OWNER" disabled>
                          OWNER
                        </option>
                      )}

                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </Select>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {member.role}
                    </span>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => {
                        setActionError(null);
                        setRemoveError(null);

                        setMemberToRemove({
                          userId: member.user.id,
                          name: member.user.name,
                        });
                      }}
                      className="h-11 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:h-auto sm:py-2"
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

      <dialog
        ref={dialogRef}
        aria-labelledby="remove-member-title"
        aria-describedby="remove-member-description"
        onCancel={(event) => {
          if (isUpdating) {
            event.preventDefault();
            return;
          }

          handleCancelRemove();
        }}
        onClose={() => {
          if (!isUpdating) {
            setRemoveError(null);
            setMemberToRemove(null);
          }
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-red-200 bg-white p-4 shadow-xl backdrop:bg-black/50 sm:p-6"
      >
        {memberToRemove && (
          <>
            <h3 id="remove-member-title" className="text-lg font-semibold text-slate-900">
              Confirmar eliminación
            </h3>

            <p id="remove-member-description" className="mt-3 text-sm wrap-anywhere text-slate-700">
              ¿Quieres quitar a {memberToRemove.name} del proyecto? Sus tareas asignadas quedarán
              sin responsable, pero no se eliminarán.
            </p>

            {/* El error queda visible dentro del dialogo. */}
            {removeError && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {removeError}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleCancelRemove}
                className="h-11 rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:h-auto sm:py-2"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => void handleRemoveMember()}
                className="h-11 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50 sm:h-auto sm:py-2"
              >
                {removeMember.isPending ? 'Quitando...' : 'Confirmar eliminación'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
