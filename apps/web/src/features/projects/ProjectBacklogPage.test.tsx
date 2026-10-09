import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { CreateWorkItemInput, ProjectRole, WorkItemDto } from '@mira/shared';
import { renderConProviders, screen, within } from '@/test/render';
import { apiError, proyectoDePrueba, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { ProjectBacklogPage } from './ProjectBacklogPage';

const PROJECT_ID = 'project_123';
const PROJECT_URL = `http://localhost:3000/api/projects/${PROJECT_ID}`;

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_1',
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: 'Elemento existente',
    description: null,
    type: 'TASK',
    status: 'BACKLOG',
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
      <Route path="/proyectos/:projectId/backlog" element={<ProjectBacklogPage />} />
    </Routes>,
    { route: `/proyectos/${PROJECT_ID}/backlog` },
  );
}

describe('ProjectBacklogPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${PROJECT_URL}/members`, () => HttpResponse.json({ members: [] })),
      http.get(`${PROJECT_URL}/work-items`, () =>
        HttpResponse.json({ data: [itemDePrueba()], total: 1, page: 1, pageSize: 20 }),
      ),
    );
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s puede abrir el formulario de creacion',
    async (role) => {
      conRol(role);
      const { user } = renderPagina();

      const create = await screen.findByRole('button', { name: '+ Crear elemento' });
      expect(create).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Titulo')).not.toBeInTheDocument();

      await user.click(create);

      expect(screen.getByLabelText('Titulo')).toBeInTheDocument();
      expect(screen.getByLabelText('Descripcion')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar formulario' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.queryByLabelText(/referencia/i)).not.toBeInTheDocument();
    },
  );

  it('VIEWER ve el backlog y sus filtros, sin CTA ni formulario de creacion', async () => {
    conRol('VIEWER');
    renderPagina();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Elemento existente')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear elemento/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Titulo')).not.toBeInTheDocument();
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s crea por POST y el nuevo item aparece sin recargar ni escribir referencia',
    async (role) => {
      conRol(role);
      const items = [itemDePrueba()];
      const requests: CreateWorkItemInput[] = [];
      let getCount = 0;
      server.use(
        http.get(`${PROJECT_URL}/work-items`, () => {
          getCount += 1;
          return HttpResponse.json({ data: items, total: items.length, page: 1, pageSize: 20 });
        }),
        http.post(`${PROJECT_URL}/work-items`, async ({ request }) => {
          const input = (await request.json()) as CreateWorkItemInput;
          requests.push(input);
          const item = itemDePrueba({
            id: 'item_2',
            reference: 'MIR-2',
            title: input.title,
            description: input.description ?? null,
            type: input.type,
            priority: input.priority,
            status: input.status,
          });
          items.push(item);
          return HttpResponse.json({ item }, { status: 201 });
        }),
      );
      const { user } = renderPagina();
      await screen.findByRole('table');
      await user.click(screen.getByRole('button', { name: '+ Crear elemento' }));
      await user.type(screen.getByLabelText('Titulo'), 'Nuevo elemento del backlog');
      await user.type(screen.getByLabelText('Descripcion'), 'Descripcion de la tarea');
      await user.click(screen.getByRole('button', { name: 'Crear elemento' }));

      expect(await screen.findByText('Elemento MIR-2 creado correctamente.')).toBeInTheDocument();
      const table = screen.getByRole('table');
      expect(await within(table).findByText('Nuevo elemento del backlog')).toBeInTheDocument();
      expect(within(table).getByText('MIR-2')).toBeInTheDocument();
      expect(within(table).getByText('Elemento existente')).toBeInTheDocument();
      expect(requests).toEqual([
        {
          title: 'Nuevo elemento del backlog',
          description: 'Descripcion de la tarea',
          type: 'TASK',
          status: 'BACKLOG',
          priority: 'MEDIUM',
        },
      ]);
      expect(getCount).toBe(2);
      expect(screen.getByLabelText('Titulo')).toHaveValue('');
    },
  );

  it('cerrar el formulario no crea un elemento y conserva el backlog', async () => {
    let posts = 0;
    conRol('OWNER');
    server.use(
      http.post(`${PROJECT_URL}/work-items`, () => {
        posts += 1;
        return HttpResponse.json({ item: itemDePrueba() }, { status: 201 });
      }),
    );
    const { user } = renderPagina();
    await user.click(await screen.findByRole('button', { name: '+ Crear elemento' }));
    await user.type(screen.getByLabelText('Titulo'), 'Borrador sin enviar');
    await user.click(screen.getByRole('button', { name: 'Cerrar formulario' }));

    expect(screen.queryByLabelText('Titulo')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it('no ofrece crear mientras espera el rol del proyecto', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(PROJECT_URL, async () => {
        await pending;
        return HttpResponse.json({ project: proyectoDePrueba({ id: PROJECT_ID }) });
      }),
    );
    renderPagina();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando proyecto...');
    expect(screen.queryByRole('button', { name: /crear elemento/i })).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('un error al obtener el proyecto muestra alerta y permite reintentar', async () => {
    server.use(http.get(PROJECT_URL, () => apiError(500, 'INTERNAL_ERROR', 'Error del proyecto')));
    const { user } = renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del proyecto');
    expect(screen.queryByRole('button', { name: /crear elemento/i })).not.toBeInTheDocument();

    conRol('MEMBER');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Crear elemento' })).toBeInTheDocument();
  });
});
