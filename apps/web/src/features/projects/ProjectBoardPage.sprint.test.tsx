import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { BoardResponse, SprintListItemDto, WorkItemDto } from '@mira/shared';
import { renderConProviders, screen } from '@/test/render';
import { apiError, proyectoDePrueba, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { COLUMNAS_DE_PRUEBA, enColumna } from '@/test/columns';
import { rangoDeSprint } from '@/features/sprints/sprintDates';
import { ProjectBoardPage } from './ProjectBoardPage';

const PROJECT_ID = 'project_123';
const PROJECT_URL = `http://localhost:3000/api/projects/${PROJECT_ID}`;

function sprintDePrueba(overrides: Partial<SprintListItemDto> = {}): SprintListItemDto {
  return {
    id: 'sprint_activo',
    projectId: PROJECT_ID,
    name: 'Sprint 3',
    goal: null,
    startDate: '2026-11-02',
    endDate: '2026-11-13',
    status: 'ACTIVE',
    committedPoints: null,
    completedPoints: null,
    createdAt: '2026-10-29T12:00:00.000Z',
    updatedAt: '2026-10-29T12:00:00.000Z',
    items: 1,
    points: 0,
    ...overrides,
  };
}

function tarjeta(id: string, title: string, sprintId: string | null): WorkItemDto {
  return {
    id,
    reference: `MIR-${id}`,
    projectId: PROJECT_ID,
    title,
    description: null,
    type: 'TASK',
    ...enColumna('TODO'),
    priority: 'MEDIUM',
    estimate: null,
    dueDate: null,
    assignee: null,
    createdBy: USUARIO_DE_PRUEBA,
    sprintId,
    createdAt: '2026-10-29T12:00:00.000Z',
    updatedAt: '2026-10-29T12:00:00.000Z',
  };
}

const TARJETAS = [
  tarjeta('1', 'Del sprint activo', 'sprint_activo'),
  tarjeta('2', 'Sin sprint', null),
  tarjeta('3', 'Del sprint planificado', 'sprint_siguiente'),
];

function conSprints(sprints: SprintListItemDto[]) {
  server.use(http.get(`${PROJECT_URL}/sprints`, () => HttpResponse.json({ data: sprints })));
}

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/tablero" element={<ProjectBoardPage />} />
    </Routes>,
    { route: `/proyectos/${PROJECT_ID}/tablero` },
  );
}

describe('ProjectBoardPage con sprints (MIR-47)', () => {
  beforeEach(() => {
    server.use(
      http.get(PROJECT_URL, () =>
        HttpResponse.json({ project: proyectoDePrueba({ id: PROJECT_ID, myRole: 'OWNER' }) }),
      ),
      http.get(`${PROJECT_URL}/members`, () => HttpResponse.json({ members: [] })),
      http.get(`${PROJECT_URL}/board`, () =>
        HttpResponse.json<BoardResponse>({ columns: COLUMNAS_DE_PRUEBA, items: TARJETAS }),
      ),
    );
  });

  it('con sprint activo muestra solo sus elementos y su nombre y fechas en el encabezado', async () => {
    const activo = sprintDePrueba();
    conSprints([
      activo,
      sprintDePrueba({ id: 'sprint_siguiente', name: 'Sprint 4', status: 'PLANNED' }),
    ]);
    renderPagina();

    expect(await screen.findByText('Del sprint activo')).toBeInTheDocument();
    expect(screen.queryByText('Sin sprint')).not.toBeInTheDocument();
    expect(screen.queryByText('Del sprint planificado')).not.toBeInTheDocument();

    const encabezado = screen.getByText(/^Sprint activo:/, { selector: 'p' });
    expect(encabezado).toHaveTextContent(`Sprint activo: Sprint 3 · ${rangoDeSprint(activo)}`);
    expect(screen.getByLabelText('Vista del tablero')).toHaveDisplayValue(
      'Sprint activo: Sprint 3',
    );
  });

  it('"Todos los elementos" vuelve a la vista sin filtro', async () => {
    conSprints([sprintDePrueba()]);
    const { user } = renderPagina();

    await screen.findByText('Del sprint activo');
    await user.selectOptions(screen.getByLabelText('Vista del tablero'), 'Todos los elementos');

    expect(screen.getByText('Del sprint activo')).toBeInTheDocument();
    expect(screen.getByText('Sin sprint')).toBeInTheDocument();
    expect(screen.getByText('Del sprint planificado')).toBeInTheDocument();
    expect(screen.queryByText(/^Sprint activo:/, { selector: 'p' })).not.toBeInTheDocument();
  });

  it('sin sprint activo muestra todos los elementos, sin selector ni encabezado de sprint', async () => {
    conSprints([
      sprintDePrueba({ id: 'sprint_siguiente', name: 'Sprint 4', status: 'PLANNED' }),
      sprintDePrueba({ id: 'sprint_viejo', name: 'Sprint 2', status: 'CLOSED' }),
    ]);
    renderPagina();

    expect(await screen.findByText('Del sprint activo')).toBeInTheDocument();
    expect(screen.getByText('Sin sprint')).toBeInTheDocument();
    expect(screen.getByText('Del sprint planificado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vista del tablero')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Sprint activo:/, { selector: 'p' })).not.toBeInTheDocument();
  });

  it('si fallan los sprints, avisa y muestra todos los elementos', async () => {
    server.use(
      http.get(`${PROJECT_URL}/sprints`, () => apiError(500, 'INTERNAL', 'Error inesperado')),
    );
    renderPagina();

    expect(
      await screen.findByText(
        'No se pudo cargar el sprint activo; se muestran todos los elementos.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Sin sprint')).toBeInTheDocument();
    expect(screen.getByText('Del sprint activo')).toBeInTheDocument();
  });

  it('al crear en la vista del sprint avisa que el elemento nace sin sprint', async () => {
    conSprints([sprintDePrueba()]);
    const { user } = renderPagina();

    await screen.findByText('Del sprint activo');
    await user.click(screen.getByRole('button', { name: '+ Crear elemento' }));

    expect(screen.getByText(/Los elementos nuevos se crean sin sprint/)).toHaveTextContent(
      'asignarlos a «Sprint 3»',
    );

    await user.selectOptions(screen.getByLabelText('Vista del tablero'), 'Todos los elementos');
    expect(screen.queryByText(/Los elementos nuevos se crean sin sprint/)).not.toBeInTheDocument();
  });
});
