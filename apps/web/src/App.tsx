import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequiereSesion, SoloInvitados } from '@/features/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectMembersPage } from '@/features/projects/ProjectMembersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { CreateProjectPage } from '@/features/projects/CreateProjectPage';
import { ProjectSettingsPage } from '@/features/projects/ProjectSettingsPage';
import { ProjectSummaryPage } from '@/features/projects/ProjectSummaryPage';
import { ProjectBacklogPage } from '@/features/projects/ProjectBacklogPage';
import { ProjectBoardPage } from '@/features/projects/ProjectBoardPage';
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

/**
 * Detalle de un elemento (MIR-14), con sus comentarios (MIR-21) e historial
 * (MIR-22). Se abre desde las tarjetas del tablero o desde el backlog (MIR-30):
 * el backlog lo indica en el state de la navegacion, y tanto "Volver" como la
 * eliminacion regresan a esa vista. Sin state (URL directa) se vuelve al tablero.
 */
function ElementoPage() {
  const { projectId = '', workItemId = '' } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const desdeBacklog = (state as { from?: string } | null)?.from === 'backlog';
  const proyecto = `/proyectos/${encodeURIComponent(projectId)}`;
  const origen = desdeBacklog ? `${proyecto}/backlog` : `${proyecto}/tablero`;

  return (
    <main className="mx-auto w-full max-w-xl min-w-0 px-4 py-6 sm:px-6">
      <Link to={origen} className="text-sm text-slate-600 underline-offset-4 hover:underline">
        {desdeBacklog ? '← Volver al backlog' : '← Volver al tablero'}
      </Link>
      <div className="mt-4">
        <WorkItemDetail
          projectId={projectId}
          workItemId={workItemId}
          onDeleted={() => navigate(origen)}
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
        <Route path="/proyectos/:projectId/backlog" element={<ProjectBacklogPage />} />

        {/* MIR-7: ver y editar el proyecto */}
        <Route path="/proyectos/:projectId/configuracion" element={<ProjectSettingsPage />} />

        {/* MIR-9: Invitacion y listado de miembros */}
        <Route path="/proyectos/:projectId/miembros" element={<ProjectMembersPage />} />

        {/* MIR-18: Tablero kanban; MIR-30: crear elementos desde el tablero */}
        <Route path="/proyectos/:projectId/tablero" element={<ProjectBoardPage />} />

        {/* MIR-14/MIR-22: detalle de un elemento con su historial */}
        <Route path="/proyectos/:projectId/elementos/:workItemId" element={<ElementoPage />} />
      </Route>

      <Route path="*" element={<Pendiente item="-" titulo="Pagina no encontrada" />} />
    </Routes>
  );
}
