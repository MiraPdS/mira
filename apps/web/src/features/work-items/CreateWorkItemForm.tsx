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
  type WorkItemStatus,
} from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useCreateWorkItem } from './useWorkItems';

export interface CreateWorkItemFormProps {
  projectId: string;
  onCreated?: (item: WorkItemDto) => void;
  /**
   * Estado con el que nace el elemento. El backlog usa BACKLOG; el tablero
   * (MIR-30) usa su primera columna, porque BACKLOG no se muestra en el tablero.
   */
  initialStatus?: WorkItemStatus;
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
export function CreateWorkItemForm({
  projectId,
  onCreated,
  initialStatus = 'BACKLOG',
}: CreateWorkItemFormProps) {
  const createWorkItem = useCreateWorkItem(projectId);
  const defaultValues = { ...DEFAULT_VALUES, status: initialStatus };
  const [createdReference, setCreatedReference] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkItemInput>({
    resolver: zodResolver(createWorkItemSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    setCreatedReference(null);

    try {
      const item = await createWorkItem.mutateAsync(values);
      reset(defaultValues);
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
          <Textarea
            id="description"
            rows={4}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            {...register('description')}
          />
        </Field>

        <Field id="type" label="Tipo" error={errors.type?.message}>
          <Select
            id="type"
            aria-invalid={Boolean(errors.type)}
            aria-describedby={errors.type ? 'type-error' : undefined}
            {...register('type')}
          >
            {WORK_ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="priority" label="Prioridad" error={errors.priority?.message}>
          <Select
            id="priority"
            aria-invalid={Boolean(errors.priority)}
            aria-describedby={errors.priority ? 'priority-error' : undefined}
            {...register('priority')}
          >
            {WORK_ITEM_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
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
