import { useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createSprintSchema, type CreateSprintInput, type SprintDto } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiRequestError } from '@/lib/api-client';
import { useCreateSprint, useUpdateSprint } from './useSprints';

/** Lo que guarda el formulario: todo texto, como lo entregan los inputs. */
interface SprintFormValues {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}

const CAMPOS = ['name', 'goal', 'startDate', 'endDate'] as const;

export interface SprintFormProps {
  projectId: string;
  /** Sprint a editar; sin el, el formulario crea uno nuevo. */
  sprint?: SprintDto;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * MIR-44: crea o edita un sprint. Valida con el mismo esquema de la API
 * (`createSprintSchema`), y los 422 del servidor se muestran junto al campo
 * que corresponde, igual que los errores del cliente.
 */
export function SprintForm({ projectId, sprint, onSaved, onCancel }: SprintFormProps) {
  const prefix = useId();
  const ids = {
    name: `${prefix}-name`,
    goal: `${prefix}-goal`,
    startDate: `${prefix}-start`,
    endDate: `${prefix}-end`,
  };
  const crear = useCreateSprint(projectId);
  const editar = useUpdateSprint(projectId, sprint?.id ?? '');
  const mutation = sprint ? editar : crear;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SprintFormValues>({
    resolver: zodResolver(createSprintSchema),
    defaultValues: {
      name: sprint?.name ?? '',
      goal: sprint?.goal ?? '',
      startDate: sprint?.startDate ?? '',
      endDate: sprint?.endDate ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    // El resolver ya devolvio los valores normalizados por el esquema
    // (trim, objetivo vacio -> null).
    const input = values as unknown as CreateSprintInput;

    try {
      if (sprint) {
        // Solo se envia lo que cambio de verdad; sin cambios no hay PATCH.
        const cambios = Object.fromEntries(
          CAMPOS.filter((campo) => (input[campo] ?? null) !== sprint[campo]).map((campo) => [
            campo,
            input[campo] ?? null,
          ]),
        );
        if (Object.keys(cambios).length === 0) {
          onCancel();
          return;
        }
        await editar.mutateAsync(cambios);
      } else {
        await crear.mutateAsync(input);
      }
      onSaved();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 422) {
        for (const campo of CAMPOS) {
          const mensaje = error.fieldError(campo);
          if (mensaje) setError(campo, { type: 'server', message: mensaje });
        }
      }
      // El resto de los errores queda en mutation.error y se muestra abajo.
    }
  });

  // El aviso general solo aparece si el error no se pudo asignar a un campo.
  const errorApi = mutation.error;
  const errorServidor =
    errorApi && !CAMPOS.some((campo) => errorApi.fieldError(campo))
      ? errorApi.status === 403
        ? 'No tienes permisos para modificar los sprints de este proyecto.'
        : errorApi.message
      : undefined;
  const pendiente = isSubmitting || mutation.isPending;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={sprint ? `Editar ${sprint.name}` : 'Crear sprint'}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6"
    >
      <Field id={ids.name} label="Nombre" error={errors.name?.message}>
        <Input
          id={ids.name}
          type="text"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${ids.name}-error` : undefined}
          {...register('name')}
        />
      </Field>

      <Field id={ids.goal} label="Objetivo (opcional)" error={errors.goal?.message}>
        <Textarea
          id={ids.goal}
          rows={3}
          aria-invalid={Boolean(errors.goal)}
          aria-describedby={errors.goal ? `${ids.goal}-error` : undefined}
          {...register('goal')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={ids.startDate} label="Fecha de inicio" error={errors.startDate?.message}>
          <Input
            id={ids.startDate}
            type="date"
            aria-invalid={Boolean(errors.startDate)}
            aria-describedby={errors.startDate ? `${ids.startDate}-error` : undefined}
            {...register('startDate')}
          />
        </Field>

        <Field id={ids.endDate} label="Fecha de termino" error={errors.endDate?.message}>
          <Input
            id={ids.endDate}
            type="date"
            aria-invalid={Boolean(errors.endDate)}
            aria-describedby={errors.endDate ? `${ids.endDate}-error` : undefined}
            {...register('endDate')}
          />
        </Field>
      </div>

      {errorServidor ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServidor}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pendiente}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando...' : sprint ? 'Guardar cambios' : 'Crear sprint'}
        </Button>
      </div>
    </form>
  );
}
