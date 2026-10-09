import { Outlet } from 'react-router-dom';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { useCurrentUser } from '@/features/auth/useAuth';

/**
 * Marco de las pantallas autenticadas.
 *
 * Se monta siempre detras de RequiereSesion, asi que aqui el usuario ya esta
 * resuelto. Las pantallas nuevas se anidan como rutas hijas y se pintan en el
 * <Outlet />.
 *
 * MIR-24: el nombre del usuario se trunca en vez de empujar "Cerrar sesion"
 * fuera de la pantalla, y el margen lateral baja a 16 px en movil, el mismo
 * que usan las paginas.
 */
export function AppLayout() {
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 sm:px-6 sm:py-3">
        <span className="shrink-0 text-lg font-semibold text-slate-900">Mira</span>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <span className="truncate text-sm text-slate-600" title={user?.name}>
            {user?.name}
          </span>
          <LogoutButton />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
