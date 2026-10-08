import { Outlet } from 'react-router-dom';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { useCurrentUser } from '@/features/auth/useAuth';

/**
 * Marco de las pantallas autenticadas.
 *
 * Se monta siempre detras de RequiereSesion, asi que aqui el usuario ya esta
 * resuelto. Las pantallas nuevas se anidan como rutas hijas y se pintan en el
 * <Outlet />.
 */
export function AppLayout() {
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <span className="text-lg font-semibold text-slate-900">Mira</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.name}</span>
          <LogoutButton />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
