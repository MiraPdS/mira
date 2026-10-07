import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequiereSesion, SoloInvitados } from '@/features/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';

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

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/proyectos" replace />} />
      <Route
        path="/login"
        element={
          <SoloInvitados>
            <LoginPage />
          </SoloInvitados>
        }
      />
      <Route
        path="/registro"
        element={
          <SoloInvitados>
            <RegisterPage />
          </SoloInvitados>
        }
      />
      {/* Rutas autenticadas: comparten guardia y header. Las pantallas nuevas
          se anidan aqui. */}
      <Route
        element={
          <RequiereSesion>
            <AppLayout />
          </RequiereSesion>
        }
      >
        <Route path="/proyectos" element={<Pendiente item="MIR-6" titulo="Mis proyectos" />} />
      </Route>
      <Route path="*" element={<Pendiente item="-" titulo="Pagina no encontrada" />} />
    </Routes>
  );
}
