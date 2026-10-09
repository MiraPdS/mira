import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type Paginated,
  type ProjectMemberDto,
  type WorkItemDto,
} from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { WorkItemBacklog } from './WorkItemBacklog';
import { projectKeys } from '@/features/projects/useProjects';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library + MSW.
 *
 * Se ejecutan el componente, TanStack Query, el hook y api-client reales.
 * MSW es el unico limite falso y representa la API HTTP.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEMS_URL = `${BASE_URL}/projects/:projectId/work-items`;
const MEMBERS_URL = `${BASE_URL}/projects/:projectId/members`;
const MEMBERS: ProjectMemberDto[] = [
  {
    id: 'membership_ada',
    role: 'OWNER',
    joinedAt: '2026-01-01T00:00:00.000Z',
    user: {
      id: 'user_ada',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
  {
    id: 'membership_grace',
    role: 'MEMBER',
    joinedAt: '2026-01-01T00:00:00.000Z',
    user: {
      id: 'user_grace',
      name: 'Grace Hopper',
      email: 'grace@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
];

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_1',
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: 'Implementar login',
    description: 'Formulario de acceso.',
    type: 'TASK',
    status: 'BACKLOG',
    priority: 'HIGH',
    estimate: null,
    dueDate: null,
    assignee: null,
    createdBy: {
      id: 'user_1',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    sprintId: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function pagina(
  data: WorkItemDto[],
  page = 1,
  total = data.length,
  pageSize = 20,
): Paginated<WorkItemDto> {
  return { data, page, pageSize, total };
}

describe('WorkItemBacklog', () => {
  beforeEach(() => {
    server.use(http.get(MEMBERS_URL, () => HttpResponse.json({ members: MEMBERS })));
  });

  it('muestra carga accesible y no renderiza una tabla mientras espera la respuesta', async () => {
    let releaseResponse!: () => void;
    const responsePending = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.get(WORK_ITEMS_URL, async () => {
        await responsePending;
        return HttpResponse.json(pagina([itemDePrueba()]));
      }),
    );

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando backlog...');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    releaseResponse();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('renderiza una tabla con encabezados y etiquetas legibles', async () => {
    const secondItem = itemDePrueba({
      id: 'item_2',
      reference: 'MIR-2',
      title: 'Corregir la sesion',
      type: 'BUG',
      status: 'TODO',
      priority: 'CRITICAL',
    });
    server.use(
      http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([itemDePrueba(), secondItem]))),
    );

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    const table = await screen.findByRole('table');
    for (const heading of ['Referencia', 'Titulo', 'Tipo', 'Estado', 'Prioridad']) {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(within(table).getByText('MIR-1')).toBeInTheDocument();
    expect(within(table).getByText('Implementar login')).toBeInTheDocument();
    expect(within(table).getByText('MIR-2')).toBeInTheDocument();
    expect(within(table).getByText('Corregir la sesion')).toBeInTheDocument();
    expect(within(table).getByText(TYPE_LABELS.TASK)).toBeInTheDocument();
    expect(within(table).getByText(STATUS_LABELS.BACKLOG)).toBeInTheDocument();
    expect(within(table).getByText(PRIORITY_LABELS.HIGH)).toBeInTheDocument();
    expect(within(table).getByText(TYPE_LABELS.BUG)).toBeInTheDocument();
    expect(within(table).getByText(STATUS_LABELS.TODO)).toBeInTheDocument();
    expect(within(table).getByText(PRIORITY_LABELS.CRITICAL)).toBeInTheDocument();
    expect(within(table).queryByText('TASK')).not.toBeInTheDocument();
  });

  it('solicita la primera pagina sin parametros de MIR-13', async () => {
    let requestedProjectId: string | undefined;
    let query: URLSearchParams | undefined;
    server.use(
      http.get(WORK_ITEMS_URL, ({ params, request }) => {
        requestedProjectId = params.projectId as string;
        query = new URL(request.url).searchParams;
        return HttpResponse.json(pagina([itemDePrueba()]));
      }),
    );

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    await screen.findByRole('table');
    expect(requestedProjectId).toBe(PROJECT_ID);
    expect(query?.get('page')).toBe('1');
    expect(query?.get('pageSize')).toBe('20');
    expect([...new Set(query?.keys())]).toEqual(['page', 'pageSize']);
  });

  it('muestra un estado vacio explicito sin renderizar una tabla', async () => {
    server.use(http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([]))));

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    expect(await screen.findByText('Aun no hay elementos en este proyecto.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el mensaje real de un error HTTP de la API', async () => {
    server.use(
      http.get(WORK_ITEMS_URL, () =>
        apiError(403, 'FORBIDDEN', 'No tienes permisos para ver este backlog'),
      ),
    );

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permisos para ver este backlog',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('deshabilita Anterior en la primera pagina y permite avanzar', async () => {
    server.use(http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([itemDePrueba()], 1, 25))));

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    expect(await screen.findByText('Pagina 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('navega a la pagina siguiente con la query correcta y actualiza los controles', async () => {
    const requestedPages: string[] = [];
    const firstPageItem = itemDePrueba({ title: 'Item de la pagina uno' });
    const secondPageItem = itemDePrueba({
      id: 'item_21',
      reference: 'MIR-21',
      title: 'Item de la pagina dos',
    });
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        requestedPages.push(page ?? '');
        return HttpResponse.json(
          page === '2' ? pagina([secondPageItem], 2, 25) : pagina([firstPageItem], 1, 25),
        );
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Item de la pagina uno');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Item de la pagina dos')).toBeInTheDocument();
    expect(screen.getByText('Pagina 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    await waitFor(() => expect(requestedPages).toContain('2'));
  });

  it('vuelve a la pagina anterior conservando los controles correctos', async () => {
    const firstPageItem = itemDePrueba({ title: 'Item de la pagina uno' });
    const secondPageItem = itemDePrueba({
      id: 'item_21',
      reference: 'MIR-21',
      title: 'Item de la pagina dos',
    });
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        return HttpResponse.json(
          page === '2' ? pagina([secondPageItem], 2, 25) : pagina([firstPageItem], 1, 25),
        );
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Item de la pagina uno');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Item de la pagina dos');
    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(await screen.findByText('Item de la pagina uno')).toBeInTheDocument();
    expect(screen.getByText('Pagina 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('muestra el mensaje de pagina fuera de rango sin confundirlo con el estado vacio', async () => {
    server.use(http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([], 50, 5))));

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    expect(await screen.findByText('No hay elementos en esta pagina.')).toBeInTheDocument();
    expect(screen.queryByText('Aun no hay elementos en este proyecto.')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('restablece la pagina al cambiar de proyecto', async () => {
    const requests: Array<{ projectId: string; page: string | null; pageSize: string | null }> = [];
    server.use(
      http.get(WORK_ITEMS_URL, ({ params, request }) => {
        const projectId = params.projectId as string;
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        const pageSize = url.searchParams.get('pageSize');
        requests.push({ projectId, page, pageSize });

        if (projectId === 'project_a' && page === '2') {
          return HttpResponse.json(
            pagina([itemDePrueba({ id: 'item_a2', title: 'Proyecto A pagina dos' })], 2, 25),
          );
        }

        if (projectId === 'project_b' && page === '1') {
          return HttpResponse.json(
            pagina(
              [
                itemDePrueba({
                  id: 'item_b1',
                  projectId: 'project_b',
                  title: 'Proyecto B pagina uno',
                }),
              ],
              1,
              25,
            ),
          );
        }

        return HttpResponse.json(
          pagina([itemDePrueba({ id: 'item_a1', title: 'Proyecto A pagina uno' })], 1, 25),
        );
      }),
    );

    const { rerender, user } = renderConProviders(<WorkItemBacklog projectId="project_a" />);
    await screen.findByText('Proyecto A pagina uno');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Proyecto A pagina dos');

    rerender(<WorkItemBacklog projectId="project_b" />);

    expect(await screen.findByText('Proyecto B pagina uno')).toBeInTheDocument();
    expect(screen.getByText('Pagina 1 de 2')).toBeInTheDocument();
    await waitFor(() =>
      expect(requests).toContainEqual({ projectId: 'project_b', page: '1', pageSize: '20' }),
    );
    expect(requests).not.toContainEqual({ projectId: 'project_b', page: '2', pageSize: '20' });
  });

  it('vuelve a la ultima pagina valida si el total disminuye', async () => {
    const requestedPages: string[] = [];
    const initialItem = itemDePrueba({ title: 'Item antes de eliminar elementos' });
    const lastPageItem = itemDePrueba({
      id: 'item_1_after_delete',
      title: 'Item de la pagina valida',
    });
    let firstPageRequest = true;

    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        requestedPages.push(page ?? '');

        if (page === '2') return HttpResponse.json(pagina([], 2, 15));
        if (firstPageRequest) {
          firstPageRequest = false;
          return HttpResponse.json(pagina([initialItem], 1, 25));
        }
        return HttpResponse.json(pagina([lastPageItem], 1, 15));
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Item antes de eliminar elementos');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Item de la pagina valida')).toBeInTheDocument();
    expect(screen.getByText('Pagina 1 de 1')).toBeInTheDocument();
    expect(screen.queryByText('Pagina 2 de 1')).not.toBeInTheDocument();
    await waitFor(() => expect(requestedPages).toEqual(['1', '2', '1']));
  });

  it('muestra controles accesibles de busqueda y filtros compartidos', async () => {
    server.use(http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([itemDePrueba()]))));

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    await screen.findByRole('table');
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Prioridad')).toBeInTheDocument();
    expect(screen.getByLabelText('Responsable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
  });

  it('busca por texto y envia q desde la primera pagina', async () => {
    const queries: Array<{ q: string | null; page: string | null }> = [];
    const foundItem = itemDePrueba({ title: 'Login encontrado' });
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        queries.push({ q: query.get('q'), page: query.get('page') });
        return HttpResponse.json(
          query.get('q') === 'login' ? pagina([foundItem]) : pagina([itemDePrueba()]),
        );
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Implementar login');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'login');

    expect(await screen.findByText('Login encontrado')).toBeInTheDocument();
    await waitFor(() => expect(queries).toContainEqual({ q: 'login', page: '1' }));
  });

  it('combina busqueda, tipo, estado, prioridad y responsable en una misma consulta', async () => {
    let query: URLSearchParams | undefined;
    const filteredItem = itemDePrueba({ title: 'Bug de login en progreso' });
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        const matches =
          query.get('q') === 'login' &&
          query.get('type') === 'BUG' &&
          query.get('status') === 'IN_PROGRESS' &&
          query.get('priority') === 'HIGH' &&
          query.get('assigneeId') === 'user_grace';
        return HttpResponse.json(matches ? pagina([filteredItem]) : pagina([itemDePrueba()]));
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Implementar login');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'login');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'BUG');
    await user.selectOptions(screen.getByLabelText('Estado'), 'IN_PROGRESS');
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Responsable'), 'user_grace');

    expect(await screen.findByText('Bug de login en progreso')).toBeInTheDocument();
    expect(query?.get('q')).toBe('login');
    expect(query?.get('type')).toBe('BUG');
    expect(query?.get('status')).toBe('IN_PROGRESS');
    expect(query?.get('priority')).toBe('HIGH');
    expect(query?.get('assigneeId')).toBe('user_grace');
  });

  it('mantiene la paginacion con filtros y vuelve a la primera pagina al cambiarlos', async () => {
    const requests: Array<{ page: string | null; type: string | null; priority: string | null }> =
      [];
    const bugPageOne = itemDePrueba({ title: 'Bug pagina uno', type: 'BUG' });
    const bugPageTwo = itemDePrueba({ id: 'item_21', title: 'Bug pagina dos', type: 'BUG' });
    const highPriorityBug = itemDePrueba({
      title: 'Bug prioritario',
      type: 'BUG',
      priority: 'HIGH',
    });
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        const page = query.get('page');
        const type = query.get('type');
        const priority = query.get('priority');
        requests.push({ page, type, priority });

        if (type === 'BUG' && priority === 'HIGH') {
          return HttpResponse.json(pagina([highPriorityBug], 1, 1));
        }
        if (type === 'BUG' && page === '2') return HttpResponse.json(pagina([bugPageTwo], 2, 25));
        if (type === 'BUG') return HttpResponse.json(pagina([bugPageOne], 1, 25));
        return HttpResponse.json(pagina([itemDePrueba()], 1, 25));
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Implementar login');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'BUG');
    expect(await screen.findByText('Bug pagina uno')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Bug pagina dos')).toBeInTheDocument();
    await waitFor(() =>
      expect(requests).toContainEqual({ page: '2', type: 'BUG', priority: null }),
    );

    await user.selectOptions(screen.getByLabelText('Prioridad'), 'HIGH');
    expect(await screen.findByText('Bug prioritario')).toBeInTheDocument();
    await waitFor(() =>
      expect(requests).toContainEqual({ page: '1', type: 'BUG', priority: 'HIGH' }),
    );
    expect(screen.getByText('Pagina 1 de 1')).toBeInTheDocument();
  });

  it('distingue un backlog vacio de una busqueda sin resultados', async () => {
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        return HttpResponse.json(q ? pagina([]) : pagina([itemDePrueba()]));
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Implementar login');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'sin coincidencias');

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByText('Aun no hay elementos en este proyecto.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeEnabled();
  });

  it('limpia los filtros y recupera el backlog sin filtrar', async () => {
    const queries: Array<string | null> = [];
    const filteredItem = itemDePrueba({ title: 'Resultado filtrado' });
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        queries.push(q);
        return HttpResponse.json(q ? pagina([filteredItem]) : pagina([itemDePrueba()]));
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    const search = await screen.findByRole('searchbox', { name: 'Buscar' });
    await user.type(search, 'login');
    expect(await screen.findByText('Resultado filtrado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(await screen.findByText('Implementar login')).toBeInTheDocument();
    expect(search).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
    await waitFor(() => expect(queries.at(-1)).toBeNull());
  });

  it('carga la lista completa del proyecto usando la cache de MIR-9', async () => {
    let requestedProject: string | undefined;
    let releaseMembers!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseMembers = resolve;
    });
    server.use(
      http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([itemDePrueba()]))),
      http.get(MEMBERS_URL, async ({ params }) => {
        requestedProject = params.projectId as string;
        await pending;
        return HttpResponse.json({ members: MEMBERS });
      }),
    );

    const { queryClient } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    const select = await screen.findByLabelText('Responsable');
    expect(select).toBeDisabled();
    expect(
      within(select).getByRole('option', { name: 'Cargando miembros...' }),
    ).toBeInTheDocument();

    releaseMembers();
    // Ninguno de estos usuarios esta asignado al unico item del backlog.
    expect(
      await within(select).findByRole('option', { name: 'Grace Hopper (grace@mira.dev)' }),
    ).toHaveValue('user_grace');
    expect(within(select).getByRole('option', { name: 'Ada Lovelace (ada@mira.dev)' })).toHaveValue(
      'user_ada',
    );
    expect(select).toBeEnabled();
    expect(requestedProject).toBe(PROJECT_ID);
    expect(queryClient.getQueryData(projectKeys.members(PROJECT_ID))).toEqual({ members: MEMBERS });
    expect(queryClient.getQueryData(projectKeys.members('otro_proyecto'))).toBeUndefined();
  });

  it('envia el id del usuario como assigneeId, nunca el id de membresia', async () => {
    const requests: Array<string | null> = [];
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const assigneeId = new URL(request.url).searchParams.get('assigneeId');
        requests.push(assigneeId);
        return HttpResponse.json(
          pagina([itemDePrueba({ title: assigneeId ? 'Item de Grace' : 'Sin filtro' })]),
        );
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByRole('option', { name: 'Grace Hopper (grace@mira.dev)' });
    await user.selectOptions(screen.getByLabelText('Responsable'), 'user_grace');

    expect(await screen.findByText('Item de Grace')).toBeInTheDocument();
    expect(requests).toContain('user_grace');
    expect(requests).not.toContain('membership_grace');

    await user.selectOptions(screen.getByLabelText('Responsable'), '');
    expect(await screen.findByText('Sin filtro')).toBeInTheDocument();
    await waitFor(() => expect(requests.at(-1)).toBeNull());
  });

  it('cambiar responsable vuelve a pagina 1 y paginar conserva el responsable', async () => {
    const requests: Array<{ page: string | null; assigneeId: string | null }> = [];
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        const page = query.get('page');
        const assigneeId = query.get('assigneeId');
        requests.push({ page, assigneeId });
        return HttpResponse.json(
          pagina(
            [itemDePrueba({ title: `${assigneeId ?? 'Todos'} pagina ${page}` })],
            Number(page),
            25,
          ),
        );
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByText('Todos pagina 1');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Todos pagina 2');

    await user.selectOptions(screen.getByLabelText('Responsable'), 'user_grace');
    expect(await screen.findByText('user_grace pagina 1')).toBeInTheDocument();
    expect(screen.getByText('Pagina 1 de 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('user_grace pagina 2');

    await user.selectOptions(screen.getByLabelText('Responsable'), 'user_ada');
    expect(await screen.findByText('user_ada pagina 1')).toBeInTheDocument();
    expect(requests).toContainEqual({ page: '2', assigneeId: 'user_grace' });
    expect(requests).toContainEqual({ page: '1', assigneeId: 'user_ada' });
    expect(requests).not.toContainEqual({ page: '2', assigneeId: 'user_ada' });
  });

  it('muestra sin resultados por responsable y limpiar elimina todos los filtros', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(query.has('assigneeId') ? pagina([]) : pagina([itemDePrueba()]));
      }),
    );

    const { user } = renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);
    await screen.findByRole('option', { name: 'Grace Hopper (grace@mira.dev)' });
    await user.type(screen.getByLabelText('Buscar'), 'login');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'BUG');
    await user.selectOptions(screen.getByLabelText('Estado'), 'TODO');
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Responsable'), 'user_grace');

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByText('Aun no hay elementos en este proyecto.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(await screen.findByText('Implementar login')).toBeInTheDocument();
    for (const label of ['Buscar', 'Tipo', 'Estado', 'Prioridad', 'Responsable']) {
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
    await waitFor(() =>
      expect([...query!.entries()]).toEqual([
        ['page', '1'],
        ['pageSize', '20'],
      ]),
    );
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
  });

  it.each(['servidor', 'red'] as const)(
    'informa error de %s al cargar miembros sin impedir ver el backlog',
    async (failure) => {
      server.use(
        http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([itemDePrueba()]))),
        http.get(MEMBERS_URL, () =>
          failure === 'red'
            ? HttpResponse.error()
            : apiError(500, 'INTERNAL_ERROR', 'No se pudo cargar el equipo'),
        ),
      );

      renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

      expect(await screen.findByText('Implementar login')).toBeInTheDocument();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        failure === 'red' ? 'No se pudo conectar con el servidor.' : 'No se pudo cargar el equipo',
      );
      expect(screen.getByLabelText('Responsable')).toBeDisabled();
      expect(screen.getByLabelText('Tipo')).toBeEnabled();
    },
  );
});
