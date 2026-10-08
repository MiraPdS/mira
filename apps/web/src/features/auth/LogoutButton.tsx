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
    <div className="flex items-center gap-3">
      {logout.isError ? (
        <p role="alert" className="text-sm text-red-700">
          No se pudo cerrar sesion. Intenta de nuevo.
        </p>
      ) : null}
      <Button variant="ghost" onClick={() => void cerrarSesion()} disabled={logout.isPending}>
        {logout.isPending ? 'Cerrando...' : 'Cerrar sesion'}
      </Button>
    </div>
  );
}
