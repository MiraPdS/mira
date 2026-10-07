import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useRegister } from './useAuth';

const CAMPOS = ['name', 'email', 'password'] as const;

/**
 * Pantalla de registro.
 *
 * Igual que LoginPage, se valida con `registerSchema` de @mira/shared: el
 * mismo esquema que Express ejecuta en el servidor.
 *
 * Los errores del servidor que pertenecen a un campo (409 EMAIL_TAKEN, 422 con
 * `fields`) se pintan bajo ese campo con setError; solo lo que no tiene campo
 * (red caida, 500) va al banner. El formulario nunca se resetea ante un
 * error, asi que lo escrito se conserva.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const registro = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registro.mutateAsync(values);
      navigate('/proyectos', { replace: true });
    } catch (error) {
      if (!(error instanceof ApiRequestError)) return;

      if (error.code === 'EMAIL_TAKEN') {
        setError('email', { type: 'EMAIL_TAKEN', message: error.message });
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
  const errorApi = registro.error instanceof ApiRequestError ? registro.error : undefined;
  const errorServidor =
    errorApi &&
    errorApi.code !== 'EMAIL_TAKEN' &&
    !CAMPOS.some((campo) => errorApi.fieldError(campo))
      ? errorApi.message
      : undefined;

  const errorEmail =
    errors.email?.type === 'EMAIL_TAKEN' ? (
      <>
        {errors.email.message}{' '}
        <Link to="/login" className="font-medium underline">
          Inicia sesion
        </Link>
      </>
    ) : (
      errors.email?.message
    );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Crear cuenta</h1>
      <p className="mb-6 text-sm text-slate-500">Registrate para empezar a usar Mira.</p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...register('name')}
          />
        </Field>

        <Field id="email" label="Correo electronico" error={errorEmail}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </Field>

        <Field
          id="password"
          label="Contrasena"
          hint="Minimo 8 caracteres, con al menos una letra y un numero."
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-hint password-error' : 'password-hint'}
            {...register('password')}
          />
        </Field>

        {errorServidor ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorServidor}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting || registro.isPending}>
          {registro.isPending ? 'Creando...' : 'Crear cuenta'}
        </Button>
      </form>
    </main>
  );
}
