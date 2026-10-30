import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  type BoardColumnDto,
  type BoardResponse,
  type ProjectRole,
  type WorkItemDto,
} from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { KanbanBoard } from './KanbanBoard';
import { columnaDe, COLUMNAS_DE_PRUEBA, enColumna } from '@/test/columns';

/**
 * NIVEL 3 de la piramide: componente con React Testing Library + MSW.
 *
 * Se ejecutan el componente, TanStack Query, el hook y api-client reales.
 * MSW es el unico limite falso y representa la API HTTP.
 *
 * El desplazamiento horizontal en 375 px es CSS y jsdom no calcula layout:
 * aqui solo se verifica que exista la region desplazable y enfocable; el
 * comportamiento visual se revisa en el navegador (y con capturas en E3).
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const BOARD_URL = `${BASE_URL}/projects/:projectId/board`;
const STATUS_URL = `${BASE_URL}/projects/:projectId/work-items/:workItemId/status`;

/**
 * Sesion iniciada y rol del usuario en el proyecto. `null` deja al usuario
 * fuera de la lista de miembros. Por defecto cada prueba corre como MEMBER.
 */
function conRol(role: ProjectRole | null) {
  server.use(
    http.get(`${BASE_URL}/auth/me`, () => HttpResponse.json({ user: USUARIO_DE_PRUEBA })),
    http.get(`${BASE_URL}/projects/:projectId/members`, () =>
      HttpResponse.json({
        members: [
          {
            id: 'membership_other',
            role: 'OWNER',
            user: { ...USUARIO_DE_PRUEBA, id: 'other_user', name: 'Otra persona' },
          },
          ...(role ? [{ id: 'membership_1', role, user: USUARIO_DE_PRUEBA }] : []),
        ],
      }),
    ),
  );
}

beforeEach(() => conRol('MEMBER'));

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_1',
    reference: 'MIR-1',
    projectId: PROJECT_ID,
    title: 'Implementar login',
    description: null,
    type: 'TASK',
    ...enColumna('TODO'),
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

function responderCon(items: WorkItemDto[]) {
  server.use(
    http.get(BOARD_URL, () =>
      HttpResponse.json<BoardResponse>({ columns: COLUMNAS_DE_PRUEBA, items }),
    ),
  );
}

/** Lista de tarjetas de una columna, buscada por su nombre accesible. */
function tarjetasDe(status: Parameters<typeof columnaDe>[0]) {
  return screen.getByRole('list', { name: `Tarjetas de ${columnaDe(status).name}` });
}

describe('KanbanBoard', () => {
  it('muestra un estado de carga accesible mientras espera la respuesta', async () => {
    let liberar!: () => void;
    const pendiente = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.get(BOARD_URL, async () => {
        await pendiente;
        return HttpResponse.json<BoardResponse>({ columns: COLUMNAS_DE_PRUEBA, items: [] });
      }),
    );

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando tablero...');
    liberar();
    expect(await screen.findByRole('heading', { name: 'Tablero' })).toBeInTheDocument();
  });

  it('solicita el tablero del proyecto indicado', async () => {
    let solicitado: string | undefined;
    server.use(
      http.get(BOARD_URL, ({ params }) => {
        solicitado = params.projectId as string;
        return HttpResponse.json<BoardResponse>({ columns: COLUMNAS_DE_PRUEBA, items: [] });
      }),
    );

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    await screen.findByRole('heading', { name: 'Tablero' });
    expect(solicitado).toBe(PROJECT_ID);
  });

  it('muestra las cuatro columnas en orden: Por hacer, En progreso, En revision y Hecho', async () => {
    responderCon([itemDePrueba()]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    const tablero = await screen.findByRole('region', { name: 'Columnas del tablero' });
    const titulos = within(tablero)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titulos).toEqual([
      expect.stringContaining('Por hacer'),
      expect.stringContaining('En progreso'),
      expect.stringContaining('En revision'),
      expect.stringContaining('Hecho'),
    ]);
    expect(within(tablero).queryByText('Backlog')).not.toBeInTheDocument();
  });

  it('ubica cada tarjeta en la columna de su estado', async () => {
    responderCon([
      itemDePrueba({ id: 'a', reference: 'MIR-1', title: 'Por empezar', ...enColumna('TODO') }),
      itemDePrueba({
        id: 'b',
        reference: 'MIR-2',
        title: 'Avanzando',
        ...enColumna('IN_PROGRESS'),
      }),
      itemDePrueba({ id: 'c', reference: 'MIR-3', title: 'Revisando', ...enColumna('IN_REVIEW') }),
      itemDePrueba({ id: 'd', reference: 'MIR-4', title: 'Terminado', ...enColumna('DONE') }),
      itemDePrueba({ id: 'e', reference: 'MIR-5', title: 'Otra mas', ...enColumna('DONE') }),
    ]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    expect(within(tarjetasDe('TODO')).getByText('Por empezar')).toBeInTheDocument();
    expect(within(tarjetasDe('IN_PROGRESS')).getByText('Avanzando')).toBeInTheDocument();
    expect(within(tarjetasDe('IN_REVIEW')).getByText('Revisando')).toBeInTheDocument();
    expect(within(tarjetasDe('DONE')).getAllByRole('listitem')).toHaveLength(2);
    expect(within(tarjetasDe('TODO')).queryByText('Terminado')).not.toBeInTheDocument();
  });

  it('muestra en la tarjeta referencia, titulo, tipo, prioridad y responsable', async () => {
    responderCon([
      itemDePrueba({
        reference: 'MIR-7',
        title: 'Corregir la sesion',
        type: 'BUG',
        priority: 'CRITICAL',
        ...enColumna('IN_PROGRESS'),
        assignee: {
          id: 'user_2',
          name: 'Grace Hopper',
          email: 'grace@mira.dev',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    const tarjeta = await screen.findByRole('article', { name: 'Corregir la sesion' });
    expect(within(tarjeta).getByText('MIR-7')).toBeInTheDocument();
    expect(within(tarjeta).getByText(TYPE_LABELS.BUG)).toBeInTheDocument();
    expect(within(tarjeta).getByText(PRIORITY_LABELS.CRITICAL)).toBeInTheDocument();
    expect(within(tarjeta).getByText('Grace Hopper')).toBeInTheDocument();
    // Nunca los valores crudos del enum.
    expect(within(tarjeta).queryByText('BUG')).not.toBeInTheDocument();
    expect(within(tarjeta).queryByText('CRITICAL')).not.toBeInTheDocument();
  });

  it('indica "Sin asignar" cuando la tarjeta no tiene responsable', async () => {
    responderCon([itemDePrueba({ title: 'Sin dueno', assignee: null })]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    const tarjeta = await screen.findByRole('article', { name: 'Sin dueno' });
    expect(within(tarjeta).getByText('Sin asignar')).toBeInTheDocument();
  });

  it('mantiene visible una columna sin items, vacia y lista para recibir tarjetas', async () => {
    responderCon([itemDePrueba({ ...enColumna('TODO') })]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    const columna = screen.getByRole('region', { name: /en revision/i });
    const lista = within(columna).getByRole('list', { name: 'Tarjetas de En revision' });
    expect(within(lista).queryAllByRole('listitem')).toHaveLength(0);
    expect(lista).toHaveAttribute('data-column-id', columnaDe('IN_REVIEW').id);
    expect(within(columna).getByText('Sin elementos')).toBeInTheDocument();
  });

  it('muestra las cuatro columnas aunque el proyecto no tenga items en el tablero', async () => {
    responderCon([]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    for (const column of COLUMNAS_DE_PRUEBA) {
      expect(screen.getByRole('list', { name: `Tarjetas de ${column.name}` })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Sin elementos')).toHaveLength(COLUMNAS_DE_PRUEBA.length);
  });

  it('expone las columnas en una region desplazable enfocable con teclado', async () => {
    responderCon([]);

    const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    const tablero = await screen.findByRole('region', { name: 'Columnas del tablero' });

    await user.tab();
    expect(tablero).toHaveFocus();
  });

  it('muestra el mensaje real de un error HTTP de la API', async () => {
    server.use(
      http.get(BOARD_URL, () => apiError(403, 'FORBIDDEN', 'No tienes permisos para ver esto')),
    );

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para ver esto');
    expect(screen.queryByRole('region', { name: 'Columnas del tablero' })).not.toBeInTheDocument();
  });

  it('informa cuando la API no responde', async () => {
    server.use(http.get(BOARD_URL, () => HttpResponse.error()));

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i);
  });

  describe('mover tarjetas con el menu "Mover a…" (MIR-19)', () => {
    /**
     * Servidor con estado: el PATCH cambia lo que devuelve el GET siguiente,
     * igual que PostgreSQL. Asi se verifica que el cambio sobreviva al
     * refresco del tablero ("persiste tras recargar").
     */
    function servidorConEstado(items: WorkItemDto[]) {
      const db = new Map(items.map((item) => [item.id, item]));
      const peticiones: { projectId: string; workItemId: string; body: unknown }[] = [];
      server.use(
        http.get(BOARD_URL, () =>
          HttpResponse.json<BoardResponse>({
            columns: COLUMNAS_DE_PRUEBA,
            items: [...db.values()],
          }),
        ),
        http.patch(STATUS_URL, async ({ params, request }) => {
          const body = (await request.json()) as { columnId: string | null };
          const workItemId = params.workItemId as string;
          peticiones.push({ projectId: params.projectId as string, workItemId, body });
          const column = COLUMNAS_DE_PRUEBA.find((c) => c.id === body.columnId) ?? null;
          const item = { ...db.get(workItemId)!, columnId: body.columnId, column };
          db.set(workItemId, item);
          return HttpResponse.json({ item });
        }),
      );
      return peticiones;
    }

    async function abrirMenuDe(
      user: ReturnType<typeof renderConProviders>['user'],
      titulo: string,
    ) {
      const tarjeta = await screen.findByRole('article', { name: titulo });
      await user.click(within(tarjeta).getByRole('button', { name: 'Mover a…' }));
      return screen.getByRole('menu');
    }

    it('ofrece solo las otras columnas del tablero, nunca la actual ni Backlog', async () => {
      responderCon([itemDePrueba({ reference: 'MIR-3', title: 'Login', ...enColumna('TODO') })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const menu = await abrirMenuDe(user, 'Login');

      expect(menu).toHaveAccessibleName('Mover MIR-3 a');
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((opcion) => opcion.textContent),
      ).toEqual(['En progreso', 'En revision', 'Hecho']);
    });

    it('mueve la tarjeta a la columna elegida y el cambio persiste al refrescar', async () => {
      const peticiones = servidorConEstado([
        itemDePrueba({ id: 'item_9', title: 'Login', ...enColumna('TODO') }),
      ]);

      const { user, queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: 'En revision' }));

      expect(within(tarjetasDe('IN_REVIEW')).getByText('Login')).toBeInTheDocument();
      expect(within(tarjetasDe('TODO')).queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      await waitFor(() => expect(peticiones).toHaveLength(1));
      expect(peticiones[0]).toEqual({
        projectId: PROJECT_ID,
        workItemId: 'item_9',
        body: { columnId: columnaDe('IN_REVIEW').id },
      });

      // Recarga: el tablero vuelve a pedirse al servidor y la tarjeta sigue ahi.
      await queryClient.resetQueries({ queryKey: ['board', PROJECT_ID] });
      expect(
        await within(
          await screen.findByRole('list', { name: 'Tarjetas de En revision' }),
        ).findByText('Login'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('mueve la tarjeta de inmediato, antes de que responda la API', async () => {
      let responder!: () => void;
      const respuesta = new Promise<void>((resolve) => {
        responder = resolve;
      });
      const item = itemDePrueba({ title: 'Login', ...enColumna('TODO') });
      responderCon([item]);
      server.use(
        http.patch(STATUS_URL, async () => {
          await respuesta;
          return HttpResponse.json({ item: { ...item, ...enColumna('DONE') } });
        }),
      );

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: 'Hecho' }));

      expect(within(tarjetasDe('DONE')).getByText('Login')).toBeInTheDocument();
      responder();
    });

    it.each([
      [
        'un error HTTP',
        () => apiError(500, 'INTERNAL_ERROR', 'Error interno del servidor'),
        /error interno del servidor/i,
      ],
      ['una falla de red', () => HttpResponse.error(), /no se pudo conectar/i],
    ])(
      'si la API responde con %s, devuelve la tarjeta a su columna y muestra el error',
      async (_caso, respuesta, mensaje) => {
        // Solo la primera lectura responde: el refresco posterior queda
        // colgado, asi que la tarjeta vuelve por el rollback y no por el GET.
        let lecturas = 0;
        const item = itemDePrueba({ reference: 'MIR-3', title: 'Login', ...enColumna('TODO') });
        server.use(
          http.get(BOARD_URL, async () => {
            if (++lecturas > 1) await new Promise(() => {});
            return HttpResponse.json<BoardResponse>({ columns: COLUMNAS_DE_PRUEBA, items: [item] });
          }),
          http.patch(STATUS_URL, respuesta),
        );

        const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
        const menu = await abrirMenuDe(user, 'Login');
        await user.click(within(menu).getByRole('menuitem', { name: 'Hecho' }));

        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('No se pudo mover MIR-3');
        expect(alerta).toHaveTextContent(mensaje);
        expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
        expect(within(tarjetasDe('DONE')).queryByText('Login')).not.toBeInTheDocument();
      },
    );

    it('un movimiento exitoso posterior limpia el error anterior', async () => {
      let fallar = true;
      const item = itemDePrueba({ title: 'Login', ...enColumna('TODO') });
      responderCon([item]);
      server.use(
        http.patch(STATUS_URL, () =>
          fallar
            ? apiError(500, 'INTERNAL_ERROR', 'Error interno del servidor')
            : HttpResponse.json({ item: { ...item, ...enColumna('IN_PROGRESS') } }),
        ),
      );

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      let menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: 'Hecho' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      fallar = false;
      menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: 'En progreso' }));

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });

    /** Espera a que el rol quede resuelto, para asertar que el menu NO aparece. */
    async function rolResuelto(
      queryClient: ReturnType<typeof renderConProviders>['queryClient'],
      estado: 'success' | 'error',
    ) {
      await waitFor(() => {
        expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('success');
        expect(queryClient.getQueryState(['projects', PROJECT_ID, 'members'])?.status).toBe(estado);
      });
    }

    it('VIEWER ve las tarjetas pero no el menu "Mover a…"', async () => {
      conRol('VIEWER');
      responderCon([itemDePrueba({ title: 'Login', ...enColumna('TODO') })]);

      const { queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      await rolResuelto(queryClient, 'success');
      expect(within(tarjeta).queryByRole('button', { name: 'Mover a…' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it.each(['OWNER', 'MEMBER'] as const)('%s ve el menu "Mover a…"', async (role) => {
      conRol(role);
      responderCon([itemDePrueba({ title: 'Login', ...enColumna('TODO') })]);

      renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      expect(await within(tarjeta).findByRole('button', { name: 'Mover a…' })).toBeInTheDocument();
    });

    it('no ofrece el menu si no se puede determinar el rol', async () => {
      server.use(
        http.get(`${BASE_URL}/projects/:projectId/members`, () =>
          apiError(500, 'INTERNAL_ERROR', 'Error interno del servidor'),
        ),
      );
      responderCon([itemDePrueba({ title: 'Login', ...enColumna('TODO') })]);

      const { queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      await rolResuelto(queryClient, 'error');
      expect(within(tarjeta).queryByRole('button', { name: 'Mover a…' })).not.toBeInTheDocument();
    });

    it('se opera completo con teclado: abre, recorre con flechas y elige', async () => {
      servidorConEstado([itemDePrueba({ title: 'Login', ...enColumna('TODO') })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      const boton = await within(tarjeta).findByRole('button', { name: 'Mover a…' });
      expect(boton).toHaveAttribute('aria-expanded', 'false');

      boton.focus();
      await user.keyboard('{Enter}');
      expect(boton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menuitem', { name: 'En progreso' })).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: 'En revision' })).toHaveFocus();
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(screen.getByRole('menuitem', { name: 'Hecho' })).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(within(tarjetasDe('DONE')).getByText('Login')).toBeInTheDocument();
    });

    it('Escape cierra el menu sin mover y devuelve el foco al boton', async () => {
      responderCon([itemDePrueba({ title: 'Login', ...enColumna('TODO') })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      await abrirMenuDe(user, 'Login');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mover a…' })).toHaveFocus();
      expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    });

    it('un clic fuera del menu lo cierra sin mover la tarjeta', async () => {
      responderCon([itemDePrueba({ title: 'Login', ...enColumna('TODO') })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      await abrirMenuDe(user, 'Login');
      await user.click(screen.getByRole('heading', { name: 'Tablero' }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    });
  });

  describe('columnas del proyecto (MIR-49)', () => {
    /**
     * Proyecto con seis columnas, algunas creadas por el equipo, que la API
     * entrega desordenadas: el tablero las muestra por `position`.
     */
    const COLUMNAS_PROPIAS: BoardColumnDto[] = [
      { id: 'col_qa', name: 'QA', position: 3, category: 'IN_PROGRESS' },
      { id: 'col_ideas', name: 'Ideas', position: 0, category: 'TODO' },
      { id: 'col_hecho', name: 'Hecho', position: 5, category: 'DONE' },
      { id: 'col_haciendo', name: 'Haciendo', position: 2, category: 'IN_PROGRESS' },
      { id: 'col_listo', name: 'Listo para empezar', position: 1, category: 'TODO' },
      { id: 'col_deploy', name: 'Esperando despliegue', position: 4, category: 'IN_PROGRESS' },
    ];
    const EN_ORDEN = [
      'Ideas',
      'Listo para empezar',
      'Haciendo',
      'QA',
      'Esperando despliegue',
      'Hecho',
    ];

    const columna = (id: string) => COLUMNAS_PROPIAS.find((c) => c.id === id)!;
    const itemEn = (id: string, overrides: Partial<WorkItemDto> = {}) =>
      itemDePrueba({ columnId: id, column: columna(id), ...overrides });

    function servidorConColumnas(items: WorkItemDto[]) {
      const db = new Map(items.map((item) => [item.id, item]));
      const cuerpos: unknown[] = [];
      server.use(
        http.get(BOARD_URL, () =>
          HttpResponse.json<BoardResponse>({ columns: COLUMNAS_PROPIAS, items: [...db.values()] }),
        ),
        http.patch(STATUS_URL, async ({ params, request }) => {
          const body = (await request.json()) as { columnId: string };
          cuerpos.push(body);
          const movido = {
            ...db.get(params.workItemId as string)!,
            columnId: body.columnId,
            column: columna(body.columnId),
          };
          db.set(movido.id, movido);
          return HttpResponse.json({ item: movido });
        }),
      );
      return cuerpos;
    }

    it('muestra las columnas del proyecto en su orden, con sus nombres', async () => {
      servidorConColumnas([]);

      renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const tablero = await screen.findByRole('region', { name: 'Columnas del tablero' });
      expect(
        within(tablero)
          .getAllByRole('heading', { level: 3 })
          .map((h) => h.textContent?.replace(/Cantidad: \d+$/, '')),
      ).toEqual(EN_ORDEN);
      expect(screen.getAllByText('Sin elementos')).toHaveLength(COLUMNAS_PROPIAS.length);
    });

    it('ubica cada tarjeta en su columna, aunque la columna la haya creado el equipo', async () => {
      servidorConColumnas([
        itemEn('col_qa', { id: 'a', title: 'En QA' }),
        itemEn('col_deploy', { id: 'b', title: 'Por desplegar' }),
      ]);

      renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      expect(
        within(await screen.findByRole('list', { name: 'Tarjetas de QA' })).getByText('En QA'),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole('list', { name: 'Tarjetas de Esperando despliegue' })).getByText(
          'Por desplegar',
        ),
      ).toBeInTheDocument();
    });

    it('el menu "Mover a…" ofrece todas las demas columnas del proyecto, en su orden', async () => {
      servidorConColumnas([itemEn('col_haciendo', { reference: 'MIR-8', title: 'Login' })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      await user.click(await within(tarjeta).findByRole('button', { name: 'Mover a…' }));

      expect(
        within(screen.getByRole('menu', { name: 'Mover MIR-8 a' }))
          .getAllByRole('menuitem')
          .map((opcion) => opcion.textContent),
      ).toEqual(EN_ORDEN.filter((nombre) => nombre !== 'Haciendo'));
    });

    it('mueve a una columna creada por el equipo enviando su id', async () => {
      const cuerpos = servidorConColumnas([itemEn('col_ideas', { title: 'Login' })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      await user.click(await within(tarjeta).findByRole('button', { name: 'Mover a…' }));
      await user.click(screen.getByRole('menuitem', { name: 'Esperando despliegue' }));

      expect(
        within(screen.getByRole('list', { name: 'Tarjetas de Esperando despliegue' })).getByText(
          'Login',
        ),
      ).toBeInTheDocument();
      await waitFor(() => expect(cuerpos).toEqual([{ columnId: 'col_deploy' }]));
    });

    it('con mas de cuatro columnas avisa que el tablero se desplaza en cualquier ancho', async () => {
      servidorConColumnas([]);

      renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const aviso = await screen.findByText('Desliza horizontalmente para ver todas las columnas.');
      expect(aviso).not.toHaveClass('xl:hidden');
    });

    it('con cuatro columnas el aviso se oculta desde xl, donde caben todas', async () => {
      responderCon([]);

      renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      expect(
        await screen.findByText('Desliza horizontalmente para ver todas las columnas.'),
      ).toHaveClass('xl:hidden');
    });

    it('un nombre largo se parte en lineas en vez de recortarse', async () => {
      servidorConColumnas([]);

      renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const titulo = await screen.findByText('Esperando despliegue');
      expect(titulo).toHaveClass('wrap-anywhere');
      expect(titulo).not.toHaveClass('truncate');
    });
  });
});
