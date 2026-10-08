import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequiereSesion, SoloInvitados } from '@/features/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectMembersPage } from '@/features/projects/ProjectMembersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';

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

      {/* Rutas protegidas que comparten el layout */}
      <Route
        element={
          <RequiereSesion>
            <AppLayout />
          </RequiereSesion>
        }
      >
        <Route path="/proyectos" element={<ProjectsPage />} />
        <Route
          path="/proyectos/nuevo"
          element={<Pendiente item="MIR-5" titulo="Nuevo proyecto" />}
        />
        <Route
          path="/proyectos/:projectId"
          element={<Pendiente item="MIR-23" titulo="Proyecto" />}
        />

        {/* MIR-9: Invitacion y listado de miembros */}
        <Route path="/proyectos/:projectId/miembros" element={<ProjectMembersPage />} />
      </Route>

      <Route path="*" element={<Pendiente item="-" titulo="Pagina no encontrada" />} />
    </Routes>
  );
}
