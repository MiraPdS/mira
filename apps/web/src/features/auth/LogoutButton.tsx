import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLogout } from './useAuth';

/**
 * Boton de cerrar sesion.
 *
 * Si el servidor falla, la sesion se MANTIENE: la cookie es httpOnly y solo
 * el servidor puede borrarla. "Cerrar localmente" mostraria al usuario como
 * deslogueado y el siguiente recargo lo volveria a dejar adentro, justo el
 * riesgo que importa en un equipo compartido.
 */
export function LogoutButton() {
  const navigate = useNavigate();
  const logout = useLogout();

  const cerrarSesion = async () => {
    try {
      await logout.mutateAsync();
      // replace: volver atras no debe dejar al usuario en una ruta protegida.
      navigate('/login', { replace: true });
    } catch {
      // El error queda en logout.error y se muestra abajo.
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-3">
      {logout.isError ? (
        <p role="alert" className="max-w-40 text-right text-sm text-red-700 sm:max-w-none">
          No se pudo cerrar sesion. Intenta de nuevo.
        </p>
      ) : null}
      <Button
        variant="ghost"
        className="px-3 whitespace-nowrap sm:px-4"
        onClick={() => void cerrarSesion()}
        disabled={logout.isPending}
      >
        {logout.isPending ? 'Cerrando...' : 'Cerrar sesion'}
      </Button>
    </div>
  );
}
