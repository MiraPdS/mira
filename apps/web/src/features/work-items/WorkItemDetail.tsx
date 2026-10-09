import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  can,
  COMMENT_MAX_LENGTH,
  createCommentSchema,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '@mira/shared';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/useAuth';
import { useProjectMembers } from '@/features/projects/useProjects';
import { ApiRequestError } from '@/lib/api-client';
import { useComments, useCreateComment, useDeleteWorkItem, useWorkItem } from './useWorkItems';
import { WorkItemEditForm } from './WorkItemEditForm';

export interface WorkItemDetailProps {
  projectId: string;
  workItemId: string;
  onDeleted?: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const calendarDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

function fechaLegible(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

function ElementoNoEncontrado() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Elemento no encontrado</h2>
      <p className="mt-1 text-sm text-slate-500">
        El elemento solicitado no existe o no esta disponible para este proyecto.
      </p>
    </section>
  );
}

/** Muestra el detalle de un elemento sin decidir rutas ni navegacion. */
export function WorkItemDetail(props: WorkItemDetailProps) {
  // Una nueva identidad no debe heredar confirmación ni resultado de eliminación.
  return (
    <WorkItemDetailContent key={JSON.stringify([props.projectId, props.workItemId])} {...props} />
  );
}

function WorkItemDetailContent({ projectId, workItemId, onDeleted }: WorkItemDetailProps) {
  const deletion = useDeleteWorkItem(projectId, workItemId);
  const { data: currentUser, isError: userError } = useCurrentUser();
  const { data: members, isError: membersError } = useProjectMembers(projectId);
  const role = members?.members.find((member) => member.user.id === currentUser?.id)?.role;
  const canDelete = !userError && !membersError && can(role, 'work-item:delete');
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  useEffect(() => {
    if (confirming) dialogRef.current?.showModal();
  }, [confirming]);
  const { data: item, error, isPending } = useWorkItem(projectId, workItemId);
  const [isEditing, setIsEditing] = useState(false);
  // MIR-21: comentarios. Los hooks van antes de los retornos tempranos.
  const canComment = !userError && !membersError && can(role, 'comment:create');
  const [commentBody, setCommentBody] = useState('');
  const commentInputId = useId();
  const commentsTitleId = useId();
  const {
    data: comments,
    isPending: commentsPending,
    error: commentsError,
    refetch: refetchComments,
  } = useComments(projectId, workItemId);
  const commentCreation = useCreateComment(projectId, workItemId);
  // Una sola regla para el boton y el envio: el mismo esquema que valida la API.
  const commentInput = createCommentSchema.safeParse({ body: commentBody });
  // 404 (elemento eliminado) y 403 (sin acceso) no se arreglan reintentando.
  const commentsErrorStatus =
    commentsError instanceof ApiRequestError ? commentsError.status : null;
  const commentsUnavailable = commentsErrorStatus === 403 || commentsErrorStatus === 404;

  function publicarComentario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentInput.success || !canComment || commentCreation.isPending) return;
    commentCreation.mutate(commentInput.data, { onSuccess: () => setCommentBody('') });
  }

  if (deletion.isSuccess) {
    return <p role="status">Elemento eliminado.</p>;
  }

  // La query se deshabilita con identificadores vacios. En TanStack Query v5
  // eso deja isPending en true, por lo que este caso debe resolverse antes de
  // mostrar el estado de carga.
  if (!projectId || !workItemId) {
    return <ElementoNoEncontrado />;
  }

  if (isPending) {
    return (
      <section role="status" className="p-6 text-sm text-slate-500">
        Cargando elemento...
      </section>
    );
  }

  if (error instanceof ApiRequestError && error.status === 404 && error.code === 'NOT_FOUND') {
    return <ElementoNoEncontrado />;
  }

  if (error || !item) {
    const message =
      error instanceof ApiRequestError ? error.message : 'No se pudo cargar el elemento.';

    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {message}
      </p>
    );
  }

  const canEdit = !userError && !membersError && can(role, 'work-item:update');

  if (isEditing && canEdit) {
    return (
      <WorkItemEditForm
        projectId={projectId}
        item={item}
        onCancel={() => setIsEditing(false)}
        onSaved={() => setIsEditing(false)}
      />
    );
  }

  return (
    <article className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-slate-500">{item.reference}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{item.title}</h2>
        {canDelete && (
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => {
              deletion.reset();
              setConfirming(true);
            }}
          >
            Eliminar elemento
          </Button>
        )}
        {canEdit ? <Button onClick={() => setIsEditing(true)}>Editar</Button> : null}
      </header>

      {confirming && (
        <dialog
          ref={dialogRef}
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          className="max-w-lg rounded-lg p-6 backdrop:bg-black/40"
          onCancel={(event) => {
            event.preventDefault();
            if (!deletion.isPending) setConfirming(false);
          }}
        >
          <h3 id={dialogTitleId} className="text-lg font-semibold">
            Eliminar elemento
          </h3>
          <p id={dialogDescriptionId} className="my-4">
            ¿Eliminar {item.reference}: {item.title}? Esta acción no se puede deshacer.
          </p>
          {deletion.error && <p role="alert">{deletion.error.message}</p>}
          <div className="mt-4 flex gap-3">
            <Button
              variant="secondary"
              autoFocus
              disabled={deletion.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deletion.isPending || !canDelete}
              onClick={() => {
                if (deletion.isPending) return;
                deletion.mutate(undefined, {
                  onSuccess: () => {
                    setConfirming(false);
                    onDeleted?.();
                  },
                });
              }}
            >
              {deletion.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </dialog>
      )}

      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-slate-500">Descripción</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
            {item.description ?? 'Sin descripción'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Tipo</dt>
          <dd className="mt-1 text-sm text-slate-900">{TYPE_LABELS[item.type]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Estado</dt>
          <dd className="mt-1 text-sm text-slate-900">{STATUS_LABELS[item.status]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Prioridad</dt>
          <dd className="mt-1 text-sm text-slate-900">{PRIORITY_LABELS[item.priority]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Responsable</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.assignee?.name ?? 'Sin asignar'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Estimación</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {item.estimate === null
              ? 'Sin estimar'
              : `${item.estimate} ${item.estimate === 1 ? 'punto' : 'puntos'}`}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Fecha límite</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {item.dueDate ? (
              <time dateTime={item.dueDate}>
                {calendarDateFormatter.format(new Date(item.dueDate))}
              </time>
            ) : (
              'Sin fecha límite'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Fecha de creación</dt>
          <dd className="mt-1 text-sm text-slate-900">
            <time dateTime={item.createdAt}>{fechaLegible(item.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Última actualización</dt>
          <dd className="mt-1 text-sm text-slate-900">
            <time dateTime={item.updatedAt}>{fechaLegible(item.updatedAt)}</time>
          </dd>
        </div>
      </dl>

      {/* MIR-21: comentarios del elemento de trabajo. */}
      <section aria-labelledby={commentsTitleId} className="mt-8 border-t border-slate-200 pt-6">
        <h3 id={commentsTitleId} className="text-lg font-semibold text-slate-900">
          Comentarios
        </h3>

        {commentsPending ? (
          <p role="status" className="mt-4 text-sm text-slate-500">
            Cargando comentarios...
          </p>
        ) : commentsUnavailable ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {commentsErrorStatus === 404
              ? 'Este elemento ya no existe.'
              : 'No tienes acceso a los comentarios de este elemento.'}
          </p>
        ) : commentsError ? (
          <div className="mt-4">
            <p role="alert" className="text-sm text-red-700">
              No se pudieron cargar los comentarios.
            </p>
            <Button variant="secondary" className="mt-2" onClick={() => void refetchComments()}>
              Reintentar
            </Button>
          </div>
        ) : comments?.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Todavía no hay comentarios.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {comments?.map((comment) => (
              <li key={comment.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {comment.author.name}
                  </span>

                  <time dateTime={comment.createdAt} className="text-xs text-slate-500">
                    {fechaLegible(comment.createdAt)}
                  </time>
                </div>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {comment.body}
                </p>
              </li>
            ))}
          </ol>
        )}

        {canComment && (
          <form
            aria-label="Nuevo comentario"
            onSubmit={publicarComentario}
            className="mt-6 border-t border-slate-200 pt-5"
          >
            <label htmlFor={commentInputId} className="block text-sm font-medium text-slate-900">
              Escribir comentario
            </label>

            <textarea
              id={commentInputId}
              value={commentBody}
              onChange={(event) => {
                setCommentBody(event.target.value);
                if (commentCreation.isError) commentCreation.reset();
              }}
              rows={4}
              maxLength={COMMENT_MAX_LENGTH}
              placeholder="Escribe un comentario..."
              disabled={commentCreation.isPending}
              className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />

            <p className="mt-1 text-xs text-slate-500">
              {commentBody.length}/{COMMENT_MAX_LENGTH} caracteres
            </p>

            {commentCreation.error && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {commentCreation.error.message}
              </p>
            )}

            <Button
              type="submit"
              className="mt-3"
              disabled={!commentInput.success || commentCreation.isPending}
            >
              {commentCreation.isPending ? 'Publicando...' : 'Publicar comentario'}
            </Button>
          </form>
        )}
      </section>
    </article>
  );
}
