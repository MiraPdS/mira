import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from './useAuth';

/**
 * Protege una ruta: si no hay sesion, redirige a login.
 *
 * Distingue "no hay sesion" (/me respondio 401 -> null) de "no se pudo
 * verificar" (red caida o 5xx). En el segundo caso NO redirige: la cookie
 * puede seguir siendo valida, y una caida de la API no debe parecer un
 * cierre de sesion.
 */
export function RequiereSesion({ children }: { children: ReactNode }) {
  const { data: user, isError, refetch, isFetching } = useCurrentUser();

  // Se mira primero el dato y despues el error: si un refetch en segundo
  // plano falla, el usuario ya resuelto sigue siendo valido y no se le quita
  // la pantalla.
  if (user) return <>{children}</>;
  if (user === null) return <Navigate to="/login" replace />;

  if (isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 sm:px-6">
        <p role="alert" className="text-sm text-red-700">
          No se pudo verificar tu sesion.
        </p>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? 'Reintentando...' : 'Reintentar'}
        </Button>
      </main>
    );
  }

  return (
    <p role="status" className="p-8 text-sm text-slate-500">
      Cargando...
    </p>
  );
}

/**
 * Para /login y /registro: quien ya tiene sesion va directo a sus proyectos.
 *
 * El formulario se muestra de inmediato, sin esperar a /me: el caso comun en
 * estas paginas es un invitado, y no tiene sentido hacerle ver "Cargando...".
 * Si /me falla, tambien se queda el formulario.
 */
export function SoloInvitados({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();

  return user ? <Navigate to="/proyectos" replace /> : <>{children}</>;
}
