import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
  updateWorkItemSchema,
  type UpdateWorkItemInput,
  type WorkItemDto,
  type WorkItemPriority,
  type WorkItemType,
} from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { useUpdateWorkItem } from './useWorkItems';

interface EditWorkItemFormValues {
  title: string;
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  estimate: string;
  dueDate: string;
}

interface NormalizedEditWorkItemValues {
  title: string;
  description: string | null;
  type: WorkItemType;
  priority: WorkItemPriority;
  estimate: number | null;
  dueDate: string | null;
}

const EDITABLE_FIELDS = [
  'title',
  'description',
  'type',
  'priority',
  'estimate',
  'dueDate',
] as const;

function isEditableField(field: unknown): field is keyof EditWorkItemFormValues {
  return (
    typeof field === 'string' && EDITABLE_FIELDS.includes(field as keyof EditWorkItemFormValues)
  );
}

function dateInputValue(dueDate: string | null): string {
  return dueDate?.slice(0, 10) ?? '';
}

function formValuesFromItem(item: WorkItemDto): EditWorkItemFormValues {
  return {
    title: item.title,
    description: item.description ?? '',
    type: item.type,
    priority: item.priority,
    estimate: item.estimate?.toString() ?? '',
    dueDate: dateInputValue(item.dueDate),
  };
}

function normalizeFormValues(values: EditWorkItemFormValues): NormalizedEditWorkItemValues {
  return {
    title: values.title,
    description: values.description.trim() || null,
    type: values.type,
    priority: values.priority,
    estimate: values.estimate === '' ? null : Number(values.estimate),
    dueDate: values.dueDate === '' ? null : values.dueDate,
  };
}

/**
 * Construye un PATCH minimo tras validar con el contrato compartido.
 *
 * Se compara con el DTO y no solo con el estado sucio del formulario: por
 * ejemplo, escribir espacios alrededor de un titulo no envia un cambio si el
 * `trim()` del contrato lo deja igual. Para fecha se compara el valor del
 * input, pues el detalle conserva una hora ISO que el control date no edita.
 */
function changedValues(
  item: WorkItemDto,
  values: EditWorkItemFormValues,
  normalized: NormalizedEditWorkItemValues,
): UpdateWorkItemInput {
  const input: UpdateWorkItemInput = {};

  if (normalized.title.trim() !== item.title) input.title = normalized.title.trim();
  if (normalized.description !== (item.description?.trim() || null)) {
    input.description = normalized.description;
  }
  if (normalized.type !== item.type) input.type = normalized.type;
  if (normalized.priority !== item.priority) input.priority = normalized.priority;
  if (normalized.estimate !== item.estimate) input.estimate = normalized.estimate;
  if (values.dueDate !== dateInputValue(item.dueDate)) {
    input.dueDate =
      normalized.dueDate === null ? null : new Date(`${normalized.dueDate}T00:00:00.000Z`);
  }

  return input;
}

export interface WorkItemEditFormProps {
  projectId: string;
  item: WorkItemDto;
  onCancel: () => void;
  onSaved: (item: WorkItemDto) => void;
}

/**
 * Editor reutilizable del detalle. No conoce rutas ni miembros del proyecto:
 * el contenedor entrega el item y decide, mediante `can`, si debe mostrarlo.
 */
export function WorkItemEditForm({ projectId, item, onCancel, onSaved }: WorkItemEditFormProps) {
  const updateWorkItem = useUpdateWorkItem(projectId, item.id);
  const [withoutChanges, setWithoutChanges] = useState(false);
  const defaultValues = formValuesFromItem(item);
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditWorkItemFormValues>({ defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors();
    updateWorkItem.reset();
    setWithoutChanges(false);

    const normalized = normalizeFormValues(values);
    const validation = updateWorkItemSchema.safeParse(normalized);

    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (isEditableField(field)) setError(field, { type: 'validate', message: issue.message });
      }
      return;
    }

    const input = changedValues(item, values, normalized);
    if (Object.keys(input).length === 0) {
      setWithoutChanges(true);
      return;
    }

    try {
      const updatedItem = await updateWorkItem.mutateAsync(input);
      onSaved(updatedItem);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        for (const field of EDITABLE_FIELDS) {
          const message = error.fieldError(field);
          if (message) setError(field, { type: 'server', message });
        }
      }
      // El error queda en la mutacion para mostrarlo y conservar el formulario.
    }
  });

  const serverError =
    updateWorkItem.error instanceof ApiRequestError ? updateWorkItem.error.message : undefined;

  return (
    <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Editar elemento</h2>
      <p className="mt-1 text-sm text-slate-500">Actualiza los campos propios de este elemento.</p>

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
            className="flex min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400"
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            {...register('description')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="type" label="Tipo" error={errors.type?.message}>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400"
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
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400"
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="estimate" label="Estimacion" error={errors.estimate?.message}>
            <Input
              id="estimate"
              type="number"
              min="0"
              max="100"
              step="1"
              aria-invalid={Boolean(errors.estimate)}
              aria-describedby={errors.estimate ? 'estimate-error' : undefined}
              {...register('estimate')}
            />
          </Field>

          <Field id="dueDate" label="Fecha limite" error={errors.dueDate?.message}>
            <Input
              id="dueDate"
              type="date"
              aria-invalid={Boolean(errors.dueDate)}
              aria-describedby={errors.dueDate ? 'dueDate-error' : undefined}
              {...register('dueDate')}
            />
          </Field>
        </div>

        {withoutChanges ? (
          <p role="status" className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
            No hay cambios para guardar.
          </p>
        ) : null}

        {serverError ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || updateWorkItem.isPending}>
            {updateWorkItem.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </section>
  );
}
