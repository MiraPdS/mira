import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { useCurrentUser } from '@/features/auth/useAuth';

/**
 * Arbol de rutas.
 *
 * Solo esta implementada la rebanada de autenticacion; el resto son marcadores
 * con el ID de Jira del item que los va a reemplazar. Se dejan visibles a
 * proposito: un enlace roto es peor que un "pendiente" explicito.
 */

function Pendiente({ item, titulo }: { item: string; titulo: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Pantalla pendiente. Item de Jira asociado: <code className="font-mono">{item}</code>
      </p>
    </main>
  );
}

/** Protege una ruta: si no hay sesion, redirige a login. */
function RequiereSesion({ children }: { children: React.ReactNode }) {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return (
      <p role="status" className="p-8 text-sm text-slate-500">
        Cargando...
      </p>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/proyectos" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<Pendiente item="MIR-2" titulo="Crear cuenta" />} />
      <Route
        path="/proyectos"
        element={
          <RequiereSesion>
            <Pendiente item="MIR-6" titulo="Mis proyectos" />
          </RequiereSesion>
        }
      />
      <Route path="*" element={<Pendiente item="-" titulo="Pagina no encontrada" />} />
    </Routes>
  );
}
