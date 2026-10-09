import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequiereSesion, SoloInvitados } from '@/features/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/features/board/KanbanBoard';
import { ProjectMembersPage } from '@/features/projects/ProjectMembersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { CreateProjectPage } from '@/features/projects/CreateProjectPage';
import { ProjectSettingsPage } from '@/features/projects/ProjectSettingsPage';

function Pendiente({ item, titulo }: { item: string; titulo: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>

      <p className="mt-2 text-sm text-slate-500">
        Pantalla pendiente. Item de Jira asociado: <code className="font-mono">{item}</code>
      </p>
    </main>
  );
}

/** Pagina del tablero: traduce la URL al proyecto que recibe KanbanBoard. */
function TableroPage() {
  const { projectId = '' } = useParams();

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6">
      <KanbanBoard projectId={projectId} />
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
        <Route path="/proyectos/nuevo" element={<CreateProjectPage />} />
        <Route
          path="/proyectos/:projectId"
          element={<Pendiente item="MIR-23" titulo="Proyecto" />}
        />

        {/* MIR-7: ver y editar el proyecto */}
        <Route path="/proyectos/:projectId/configuracion" element={<ProjectSettingsPage />} />

        {/* MIR-9: Invitacion y listado de miembros */}
        <Route path="/proyectos/:projectId/miembros" element={<ProjectMembersPage />} />

        {/* MIR-18: Tablero kanban */}
        <Route path="/proyectos/:projectId/tablero" element={<TableroPage />} />
      </Route>

      <Route path="*" element={<Pendiente item="-" titulo="Pagina no encontrada" />} />
    </Routes>
  );
}
