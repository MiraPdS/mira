import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { BoardResponse, CreateWorkItemInput, ProjectRole, WorkItemDto } from '@mira/shared';
import { renderConProviders, screen, within } from '@/test/render';
import { proyectoDePrueba, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { ProjectBoardPage } from './ProjectBoardPage';

const PROJECT_ID = 'project_123';
const PROJECT_URL = `http://localhost:3000/api/projects/${PROJECT_ID}`;

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_1',
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: 'Tarjeta existente',
    description: null,
    type: 'TASK',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    estimate: null,
    dueDate: null,
    assignee: null,
    createdBy: USUARIO_DE_PRUEBA,
    sprintId: null,
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:00:00.000Z',
    ...overrides,
  };
}

function conRol(myRole: ProjectRole) {
  server.use(
    http.get(PROJECT_URL, () =>
      HttpResponse.json({ project: proyectoDePrueba({ id: PROJECT_ID, myRole }) }),
    ),
  );
}

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/tablero" element={<ProjectBoardPage />} />
    </Routes>,
    { route: `/proyectos/${PROJECT_ID}/tablero` },
  );
}

describe('ProjectBoardPage (MIR-30)', () => {
  beforeEach(() => {
    server.use(
      http.get(`${PROJECT_URL}/members`, () => HttpResponse.json({ members: [] })),
      http.get(`${PROJECT_URL}/board`, () =>
        HttpResponse.json<BoardResponse>({ items: [itemDePrueba()] }),
      ),
    );
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s puede abrir el formulario desde el tablero',
    async (role) => {
      conRol(role);
      const { user } = renderPagina();

      const create = await screen.findByRole('button', { name: '+ Crear elemento' });
      expect(create).toHaveAttribute('aria-expanded', 'false');

      await user.click(create);

      expect(screen.getByLabelText('Titulo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar formulario' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    },
  );

  it('VIEWER ve el tablero sin el boton de crear', async () => {
    conRol('VIEWER');
    renderPagina();

    expect(await screen.findByText('Tarjeta existente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear elemento/i })).not.toBeInTheDocument();
  });

  it('crea en "Por hacer" y la tarjeta aparece en esa columna sin recargar', async () => {
    conRol('MEMBER');
    const items = [itemDePrueba()];
    const requests: CreateWorkItemInput[] = [];
    server.use(
      http.get(`${PROJECT_URL}/board`, () => HttpResponse.json<BoardResponse>({ items })),
      http.post(`${PROJECT_URL}/work-items`, async ({ request }) => {
        const input = (await request.json()) as CreateWorkItemInput;
        requests.push(input);
        const item = itemDePrueba({
          id: 'item_2',
          reference: 'MIR-2',
          title: input.title,
          type: input.type,
          priority: input.priority,
          status: input.status,
        });
        items.push(item);
        return HttpResponse.json({ item }, { status: 201 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: '+ Crear elemento' }));
    await user.type(screen.getByLabelText('Titulo'), 'Creada desde el tablero');
    await user.click(screen.getByRole('button', { name: 'Crear elemento' }));

    expect(await screen.findByText('Elemento MIR-2 creado correctamente.')).toBeInTheDocument();
    const porHacer = screen.getByRole('list', { name: 'Tarjetas de Por hacer' });
    expect(await within(porHacer).findByText('Creada desde el tablero')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ title: 'Creada desde el tablero', status: 'TODO' });
  });
});
