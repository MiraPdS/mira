import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@mira/shared';
import { ApiRequestError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useLogin } from './useAuth';

/**
 * Pantalla de inicio de sesion.
 *
 * Punto clave del diseno: el formulario se valida con `loginSchema`, EL MISMO
 * esquema Zod que Express ejecuta en el servidor. No hay dos definiciones de
 * "correo valido" que puedan divergir; hay una sola, en @mira/shared.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate('/proyectos', { replace: true });
    } catch {
      // El error queda en login.error y se muestra abajo; no se relanza para
      // que React no lo trate como un rechazo sin manejar.
    }
  });

  const errorServidor = login.error instanceof ApiRequestError ? login.error.message : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Iniciar sesion</h1>
      <p className="mb-6 text-sm text-slate-500">Accede a tus proyectos en Mira.</p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="email" label="Correo electronico" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </Field>

        <Field id="password" label="Contrasena" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
        </Field>

        {errorServidor ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorServidor}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting || login.isPending}>
          {login.isPending ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        No tienes cuenta{' '}
        <Link to="/registro" className="font-medium text-slate-900 underline">
          Registrate
        </Link>
      </p>
    </main>
  );
}
