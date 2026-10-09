import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { createProjectSchema, type CreateProjectInput } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { useCreateProject } from './useProjects';

const CAMPOS = ['name', 'key', 'description'] as const;

/**
 * Pantalla "Nuevo proyecto" (MIR-5, parte web).
 *
 * Misma receta que RegisterPage: se valida con `createProjectSchema` de
 * @mira/shared, los errores del servidor con campo (409 PROJECT_KEY_TAKEN,
 * 422) van bajo ese campo y el resto al banner. Lo escrito nunca se resetea
 * ante un error.
 */
export function CreateProjectPage() {
  const navigate = useNavigate();
  const crear = useCreateProject();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', key: '', description: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // createProjectSchema ya convierte una descripcion vacia en null.
      await crear.mutateAsync(values);
      navigate('/proyectos', { replace: true });
    } catch (error) {
      if (!(error instanceof ApiRequestError)) return;

      if (error.code === 'PROJECT_KEY_TAKEN') {
        setError(
          'key',
          { type: 'PROJECT_KEY_TAKEN', message: error.message },
          { shouldFocus: true },
        );
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
  const errorApi = crear.error instanceof ApiRequestError ? crear.error : undefined;
  const errorServidor =
    errorApi &&
    errorApi.code !== 'PROJECT_KEY_TAKEN' &&
    !CAMPOS.some((campo) => errorApi.fieldError(campo))
      ? errorApi.message
      : undefined;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Nuevo proyecto</h1>
      <p className="mb-6 text-sm text-slate-500">Quedaras como propietario del proyecto.</p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input
            id="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...register('name')}
          />
        </Field>

        <Field
          id="key"
          label="Clave"
          hint="De 2 a 8 letras o numeros, empezando por letra. Es el prefijo de las tarjetas (MIR-1)."
          error={errors.key?.message}
        >
          <Input
            id="key"
            autoComplete="off"
            className="uppercase"
            aria-invalid={Boolean(errors.key)}
            aria-describedby={errors.key ? 'key-hint key-error' : 'key-hint'}
            {...register('key')}
          />
        </Field>

        <Field id="description" label="Descripcion (opcional)" error={errors.description?.message}>
          <Textarea
            id="description"
            rows={4}
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

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            to="/proyectos"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline sm:min-h-0"
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={isSubmitting || crear.isPending}
          >
            {crear.isPending ? 'Creando...' : 'Crear proyecto'}
          </Button>
        </div>
      </form>
    </main>
  );
}
