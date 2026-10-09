import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  createWorkItemSchema,
  PRIORITY_LABELS,
  TYPE_LABELS,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
  type CreateWorkItemInput,
  type WorkItemDto,
} from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { useCreateWorkItem } from './useWorkItems';

export interface CreateWorkItemFormProps {
  projectId: string;
  onCreated?: (item: WorkItemDto) => void;
}

const DEFAULT_VALUES: CreateWorkItemInput = {
  title: '',
  description: '',
  type: 'TASK',
  priority: 'MEDIUM',
  status: 'BACKLOG',
};

/**
 * Formulario reutilizable de creacion. Recibe el proyecto desde su contenedor
 * para no decidir rutas, navegacion ni el flujo de proyectos.
 */
export function CreateWorkItemForm({ projectId, onCreated }: CreateWorkItemFormProps) {
  const createWorkItem = useCreateWorkItem(projectId);
  const [createdReference, setCreatedReference] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkItemInput>({
    resolver: zodResolver(createWorkItemSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = handleSubmit(async (values) => {
    setCreatedReference(null);

    try {
      const item = await createWorkItem.mutateAsync(values);
      reset(DEFAULT_VALUES);
      setCreatedReference(item.reference);
      onCreated?.(item);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const titleError = error.fieldError('title');
        if (titleError) setError('title', { type: 'server', message: titleError });
      }
      // El error queda en createWorkItem.error para mostrarlo sin relanzarlo.
    }
  });

  const errorServidor =
    createWorkItem.error instanceof ApiRequestError ? createWorkItem.error.message : undefined;

  return (
    <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-slate-900">Crear elemento</h2>
      <p className="mt-1 text-sm text-slate-500">Registra una tarea, historia, bug o epica.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field id="title" label="Titulo" error={errors.title?.message}>
          <Input
            id="title"
            type="text"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'title-error' : undefined}
            {...register('title')}
          />
        </Field>

        <Field id="description" label="Descripcion" error={errors.description?.message}>
          <textarea
            id="description"
            rows={4}
            className="flex min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400"
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            {...register('description')}
          />
        </Field>

        <Field id="type" label="Tipo" error={errors.type?.message}>
          <select
            id="type"
            className="flex h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:h-10 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400"
            aria-invalid={Boolean(errors.type)}
            aria-describedby={errors.type ? 'type-error' : undefined}
            {...register('type')}
          >
            {WORK_ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="priority" label="Prioridad" error={errors.priority?.message}>
          <select
            id="priority"
            className="flex h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:h-10 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400"
            aria-invalid={Boolean(errors.priority)}
            aria-describedby={errors.priority ? 'priority-error' : undefined}
            {...register('priority')}
          >
            {WORK_ITEM_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>

        {createdReference ? (
          <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Elemento {createdReference} creado correctamente.
          </p>
        ) : null}

        {errorServidor ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorServidor}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || createWorkItem.isPending}
        >
          {createWorkItem.isPending ? 'Creando...' : 'Crear elemento'}
        </Button>
      </form>
    </section>
  );
}
