import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type {
  BoardColumnDto,
  BoardResponse,
  CreateBoardColumnInput,
  ProjectRole,
  UpdateBoardColumnInput,
  WorkItemDto,
} from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError, proyectoDePrueba, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { COLUMNAS_DE_PRUEBA, enColumna } from '@/test/columns';
import { ProjectSettingsPage } from '@/features/projects/ProjectSettingsPage';

const PROJECT_ID = 'project_1';
const BASE = `http://localhost:3000/api/projects/${PROJECT_ID}`;

function itemEn(columnId: string, id: string): WorkItemDto {
  const column = COLUMNAS_DE_PRUEBA.find((candidate) => candidate.id === columnId)!;
  return {
    id,
    reference: `MIR-${id}`,
    projectId: PROJECT_ID,
    title: `Elemento ${id}`,
    description: null,
    type: 'TASK',
    ...enColumna('BACKLOG'),
    columnId,
    column,
    priority: 'MEDIUM',
    estimate: null,
    dueDate: null,
    assignee: null,
    createdBy: USUARIO_DE_PRUEBA,
    sprintId: null,
    createdAt: '2026-10-30T12:00:00.000Z',
    updatedAt: '2026-10-30T12:00:00.000Z',
  };
}

function conRol(myRole: ProjectRole) {
  server.use(
    http.get(BASE, () =>
      HttpResponse.json({ project: proyectoDePrueba({ id: PROJECT_ID, myRole }) }),
    ),
  );
}

/** Columnas en memoria: cada GET devuelve el estado actual, como la API. */
function conColumnas(inicial: BoardColumnDto[] = COLUMNAS_DE_PRUEBA) {
  const estado = { columns: inicial.map((column) => ({ ...column })) };
  server.use(http.get(`${BASE}/columns`, () => HttpResponse.json({ columns: estado.columns })));
  return estado;
}

function conTablero(items: WorkItemDto[]) {
  server.use(
    http.get(`${BASE}/board`, () =>
      HttpResponse.json<BoardResponse>({ columns: COLUMNAS_DE_PRUEBA, items }),
    ),
  );
}

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/configuracion" element={<ProjectSettingsPage />} />
    </Routes>,
    { route: `/proyectos/${PROJECT_ID}/configuracion` },
  );
}

async function filas() {
  const lista = await screen.findByRole('list', { name: 'Columnas en el orden del tablero' });
  return within(lista)
    .getAllByRole('heading', { level: 3 })
    .map((titulo) => titulo.textContent);
}

describe('BoardColumnsSettings (MIR-50)', () => {
  beforeEach(() => {
    conRol('OWNER');
    conColumnas();
    conTablero([]);
  });

  it('OWNER ve las columnas en su orden, con su categoria y los controles para modificarlas', async () => {
    renderPagina();

    expect(await filas()).toEqual(['Por hacer', 'En progreso', 'En revision', 'Hecho']);
    expect(screen.getByRole('heading', { name: 'Columnas del tablero' })).toBeInTheDocument();
    expect(screen.getAllByText('En curso')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '+ Agregar columna' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar columna Hecho' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar columna Hecho' })).toBeInTheDocument();
    // En los extremos no se puede subir ni bajar mas.
    expect(screen.getByRole('button', { name: 'Subir Por hacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Hecho' })).toBeDisabled();
  });

  it.each(['MEMBER', 'VIEWER'] as const)(
    '%s ve las columnas pero no puede modificarlas',
    async (role) => {
      conRol(role);
      renderPagina();

      expect(await filas()).toEqual(['Por hacer', 'En progreso', 'En revision', 'Hecho']);
      expect(
        screen.getByText('Solo el propietario del proyecto puede modificarlas.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /agregar columna/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(subir|bajar) /i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /columna/i })).not.toBeInTheDocument();
    },
  );

  it('OWNER agrega una columna y aparece al final sin recargar', async () => {
    const estado = conColumnas();
    const posts: CreateBoardColumnInput[] = [];
    server.use(
      http.post(`${BASE}/columns`, async ({ request }) => {
        const input = (await request.json()) as CreateBoardColumnInput;
        posts.push(input);
        const column = { id: 'col_qa', position: 4, ...input };
        estado.columns.push(column);
        return HttpResponse.json({ column }, { status: 201 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: '+ Agregar columna' }));
    const form = screen.getByRole('form', { name: 'Agregar columna' });
    await user.type(within(form).getByLabelText('Nombre'), '  QA  ');
    await user.selectOptions(within(form).getByLabelText('Categoria'), 'IN_PROGRESS');
    await user.click(within(form).getByRole('button', { name: 'Agregar' }));

    await screen.findByRole('button', { name: 'Editar columna QA' });
    expect(await filas()).toEqual(['Por hacer', 'En progreso', 'En revision', 'Hecho', 'QA']);
    expect(posts).toEqual([{ name: 'QA', category: 'IN_PROGRESS' }]);
    expect(screen.queryByRole('form', { name: 'Agregar columna' })).not.toBeInTheDocument();
  });

  it('un nombre vacio se marca junto al campo y no se envia', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/columns`, () => {
        posts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: '+ Agregar columna' }));
    const form = screen.getByRole('form', { name: 'Agregar columna' });
    await user.click(within(form).getByRole('button', { name: 'Agregar' }));

    const nombre = within(form).getByLabelText('Nombre');
    expect(nombre).toHaveAttribute('aria-invalid', 'true');
    expect(nombre).toHaveAccessibleDescription('El nombre de la columna no puede estar vacio');
    expect(posts).toBe(0);
  });

  it('OWNER renombra una columna enviando solo el nombre', async () => {
    const estado = conColumnas();
    const patches: UpdateBoardColumnInput[] = [];
    server.use(
      http.patch(`${BASE}/columns/col_review`, async ({ request }) => {
        const input = (await request.json()) as UpdateBoardColumnInput;
        patches.push(input);
        const column = { ...estado.columns[2]!, ...input };
        estado.columns[2] = column;
        return HttpResponse.json({ column });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Editar columna En revision' }));
    const form = screen.getByRole('form', { name: 'Editar columna En revision' });
    const nombre = within(form).getByLabelText('Nombre');
    await user.clear(nombre);
    await user.type(nombre, 'Code review');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));

    await screen.findByRole('button', { name: 'Editar columna Code review' });
    expect(await filas()).toEqual(['Por hacer', 'En progreso', 'Code review', 'Hecho']);
    expect(patches).toEqual([{ name: 'Code review' }]);
  });

  it('OWNER reordena: bajar una columna envia el orden completo y la lista lo refleja', async () => {
    const estado = conColumnas();
    const ordenes: string[][] = [];
    server.use(
      http.put(`${BASE}/columns/order`, async ({ request }) => {
        const { columnIds } = (await request.json()) as { columnIds: string[] };
        ordenes.push(columnIds);
        estado.columns = columnIds.map((id, position) => ({
          ...estado.columns.find((column) => column.id === id)!,
          position,
        }));
        return HttpResponse.json({ columns: estado.columns });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Bajar Por hacer' }));

    await screen.findByRole('button', { name: 'Subir Por hacer' });
    expect(await filas()).toEqual(['En progreso', 'Por hacer', 'En revision', 'Hecho']);
    expect(ordenes).toEqual([['col_doing', 'col_todo', 'col_review', 'col_done']]);
  });

  it('eliminar una columna sin elementos solo pide confirmar y no envia destino', async () => {
    const estado = conColumnas();
    const borrados: string[] = [];
    server.use(
      http.delete(`${BASE}/columns/:columnId`, ({ params, request }) => {
        borrados.push(`${String(params.columnId)}${new URL(request.url).search}`);
        estado.columns = estado.columns.filter((column) => column.id !== params.columnId);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Eliminar columna En revision' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar columna' });
    expect(await within(dialogo).findByText(/No tiene elementos/)).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText('Mover sus elementos a')).not.toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await filas()).toEqual(['Por hacer', 'En progreso', 'Hecho']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(borrados).toEqual(['col_review']);
  });

  it('eliminar una columna con elementos pide la columna de destino y la envia', async () => {
    conTablero([itemEn('col_doing', '1'), itemEn('col_doing', '2'), itemEn('col_todo', '3')]);
    const estado = conColumnas();
    const borrados: string[] = [];
    server.use(
      http.delete(`${BASE}/columns/:columnId`, ({ params, request }) => {
        borrados.push(`${String(params.columnId)}${new URL(request.url).search}`);
        estado.columns = estado.columns.filter((column) => column.id !== params.columnId);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Eliminar columna En progreso' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar columna' });
    expect(await within(dialogo).findByText(/tiene 2 elementos/)).toBeInTheDocument();
    const destino = within(dialogo).getByLabelText('Mover sus elementos a');
    expect(
      within(destino)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Por hacer', 'En revision', 'Hecho']);
    await user.selectOptions(destino, 'col_done');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await filas()).toEqual(['Por hacer', 'En revision', 'Hecho']);
    expect(borrados).toEqual(['col_doing?moveTo=col_done']);
  });

  it('si la API responde que la columna tiene elementos, pide el destino y reintenta', async () => {
    const borrados: string[] = [];
    server.use(
      http.delete(`${BASE}/columns/:columnId`, ({ params, request }) => {
        const search = new URL(request.url).search;
        borrados.push(`${String(params.columnId)}${search}`);
        if (!search) {
          return apiError(409, 'COLUMN_NOT_EMPTY', 'La columna tiene elementos');
        }
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Eliminar columna Por hacer' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar columna' });
    await within(dialogo).findByText(/No tiene elementos/);
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    const destino = await within(dialogo).findByLabelText('Mover sus elementos a');
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument();
    await user.selectOptions(destino, 'col_review');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(borrados).toEqual(['col_todo', 'col_todo?moveTo=col_review']);
  });

  it('no permite eliminar la ultima columna Terminado y lo explica en el dialogo', async () => {
    server.use(
      http.delete(`${BASE}/columns/:columnId`, () =>
        apiError(
          409,
          'LAST_DONE_COLUMN',
          'El proyecto debe conservar al menos una columna de categoria DONE',
        ),
      ),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Eliminar columna Hecho' }));
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar columna' });
    await within(dialogo).findByText(/No tiene elementos/);
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'El proyecto debe conservar al menos una columna de categoria DONE',
    );
    expect(await filas()).toEqual(['Por hacer', 'En progreso', 'En revision', 'Hecho']);
  });
});
