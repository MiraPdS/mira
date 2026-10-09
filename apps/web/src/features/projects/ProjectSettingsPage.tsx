import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  can,
  ROLE_LABELS,
  updateProjectSchema,
  type ProjectDto,
  type UpdateProjectInput,
} from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { projectKeys, useProject, useUpdateProject } from './useProjects';

const CAMPOS = ['name', 'description'] as const;

/**
 * Configuracion del proyecto (MIR-7): cualquier miembro lo ve; solo quien
 * puede `project:update` (el OWNER) ve el boton "Editar".
 */
export function ProjectSettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const proyecto = useProject(projectId);
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <Link to="/proyectos" className="text-sm text-slate-600 underline">
        Volver a proyectos
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-semibold text-slate-900">
        Configuracion del proyecto
      </h1>

      {/* Fuera del formulario: debe seguir visible cuando el refetch lo oculta. */}
      {sinPermiso ? (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Ya no tienes permisos para editar este proyecto.
        </p>
      ) : null}

      {proyecto.isPending ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando proyecto...
        </p>
      ) : proyecto.isError ? (
        proyecto.error.status === 403 ? (
          <p role="alert" className="text-sm text-red-700">
            No tienes acceso a este proyecto.
          </p>
        ) : (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-red-700">No se pudo cargar el proyecto.</p>
            <Button variant="secondary" onClick={() => void proyecto.refetch()}>
              Reintentar
            </Button>
          </div>
        )
      ) : editando && can(proyecto.data.myRole, 'project:update') ? (
        <EditProjectForm
          project={proyecto.data}
          onCancel={() => setEditando(false)}
          onSaved={() => {
            setEditando(false);
            setGuardado(true);
          }}
          onForbidden={() => {
            setEditando(false);
            setSinPermiso(true);
          }}
        />
      ) : (
        <ProjectDetails
          project={proyecto.data}
          guardado={guardado}
          onEdit={() => {
            setGuardado(false);
            setSinPermiso(false);
            setEditando(true);
          }}
        />
      )}
    </main>
  );
}

function ProjectDetails({
  project,
  guardado,
  onEdit,
}: {
  project: ProjectDto;
  guardado: boolean;
  onEdit: () => void;
}) {
  return (
    <section className="space-y-4">
      {guardado ? (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Cambios guardados
        </p>
      ) : null}

      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-slate-700">Nombre</dt>
          <dd className="mt-1 text-slate-900">{project.name}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Clave</dt>
          <dd className="mt-1 font-mono text-slate-900">{project.key}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Descripcion</dt>
          <dd className="mt-1 whitespace-pre-line text-slate-900">
            {project.description ?? <span className="text-slate-500">Sin descripcion</span>}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Tu rol</dt>
          <dd className="mt-1 text-slate-900">{ROLE_LABELS[project.myRole]}</dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/proyectos/${encodeURIComponent(project.id)}/miembros`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Ver equipo
        </Link>
        {can(project.myRole, 'project:update') ? <Button onClick={onEdit}>Editar</Button> : null}
      </div>
    </section>
  );
}

/**
 * Formulario de edicion. Misma receta que CreateProjectPage, con dos
 * diferencias: solo se envian los campos tocados (la bitacora registra por
 * campo) y un 403 refresca el proyecto para que el boton desaparezca solo.
 */
function EditProjectForm({
  project,
  onCancel,
  onSaved,
  onForbidden,
}: {
  project: ProjectDto;
  onCancel: () => void;
  onSaved: () => void;
  onForbidden: () => void;
}) {
  const queryClient = useQueryClient();
  const editar = useUpdateProject(project.id);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: { name: project.name, description: project.description ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const cambios: UpdateProjectInput = {};
    for (const campo of CAMPOS) {
      if (dirtyFields[campo]) Object.assign(cambios, { [campo]: values[campo] });
    }

    try {
      await editar.mutateAsync(cambios);
      onSaved();
    } catch (error) {
      if (!(error instanceof ApiRequestError)) return;

      if (error.status === 403) {
        // Probablemente le quitaron el rol OWNER: el refetch trae el rol nuevo.
        void queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
        onForbidden();
        return;
      }

      if (error.status === 422) {
        for (const campo of CAMPOS) {
          const mensaje = error.fieldError(campo);
          if (mensaje) setError(campo, { type: 'server', message: mensaje });
        }
      }
    }
  });

  // El banner solo aparece si el error no se pudo asignar a un campo.
  const errorApi = editar.error;
  const errorServidor =
    errorApi && !CAMPOS.some((campo) => errorApi.fieldError(campo)) ? errorApi.message : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="name" label="Nombre" error={errors.name?.message}>
        <Input
          id="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          {...register('name')}
        />
      </Field>

      <Field id="key" label="Clave" hint="La clave no se puede cambiar.">
        <Input
          id="key"
          value={project.key}
          readOnly
          className="font-mono"
          aria-describedby="key-hint"
        />
      </Field>

      <Field id="description" label="Descripcion (opcional)" error={errors.description?.message}>
        <textarea
          id="description"
          rows={4}
          className={cn(
            'flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm',
            'placeholder:text-slate-400 focus-visible:ring-2 focus-visible:outline-none',
            'focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400',
          )}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'description-error' : undefined}
          {...register('description')}
        />
      </Field>

      {errorServidor ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServidor}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isDirty || editar.isPending}>
          {editar.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
