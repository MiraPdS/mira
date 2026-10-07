import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type Paginated,
  type WorkItemDto,
} from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { WorkItemBacklog } from './WorkItemBacklog';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library + MSW.
 *
 * Se ejecutan el componente, TanStack Query, el hook y api-client reales.
 * MSW es el unico limite falso y representa la API HTTP.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEMS_URL = `${BASE_URL}/projects/:projectId/work-items`;

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

  it('no muestra controles de busqueda, filtros ni orden de MIR-13', async () => {
    server.use(http.get(WORK_ITEMS_URL, () => HttpResponse.json(pagina([itemDePrueba()]))));

    renderConProviders(<WorkItemBacklog projectId={PROJECT_ID} />);

    await screen.findByRole('table');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/busqueda|tipo|estado|prioridad|responsable|orden/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /filtrar|ordenar/i })).not.toBeInTheDocument();
  });
});
