import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequiereSesion, SoloInvitados } from '@/features/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/features/board/KanbanBoard';
import { ProjectMembersPage } from '@/features/projects/ProjectMembersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { CreateProjectPage } from '@/features/projects/CreateProjectPage';
import { ProjectSettingsPage } from '@/features/projects/ProjectSettingsPage';
import { ProjectSummaryPage } from '@/features/projects/ProjectSummaryPage';
import { WorkItemDetail } from '@/features/work-items/WorkItemDetail';

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

/**
 * Detalle de un elemento (MIR-14), con sus comentarios (MIR-21) e historial
 * (MIR-22).  Se abre desde las tarjetas del tablero; al eliminarlo se vuelve
 * al tablero.
 */
function ElementoPage() {
  const { projectId = '', workItemId = '' } = useParams();
  const navigate = useNavigate();
  const tablero = `/proyectos/${encodeURIComponent(projectId)}/tablero`;

  return (
    <main className="mx-auto w-full max-w-xl min-w-0 px-4 py-6 sm:px-6">
      <Link to={tablero} className="text-sm text-slate-600 underline-offset-4 hover:underline">
        ← Volver al tablero
      </Link>
      <div className="mt-4">
        <WorkItemDetail
          projectId={projectId}
          workItemId={workItemId}
          onDeleted={() => navigate(tablero)}
        />
      </div>
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
        <Route path="/proyectos/:projectId" element={<ProjectSummaryPage />} />

        {/* MIR-7: ver y editar el proyecto */}
        <Route path="/proyectos/:projectId/configuracion" element={<ProjectSettingsPage />} />

        {/* MIR-9: Invitacion y listado de miembros */}
        <Route path="/proyectos/:projectId/miembros" element={<ProjectMembersPage />} />

        {/* MIR-18: Tablero kanban */}
        <Route path="/proyectos/:projectId/tablero" element={<TableroPage />} />

        {/* MIR-14/MIR-22: detalle de un elemento con su historial */}
        <Route path="/proyectos/:projectId/elementos/:workItemId" element={<ElementoPage />} />
      </Route>

      <Route path="*" element={<Pendiente item="-" titulo="Pagina no encontrada" />} />
    </Routes>
  );
}
