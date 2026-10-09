import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  BOARD_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type BoardResponse,
  type ProjectRole,
  type WorkItemDto,
  type WorkItemStatus,
} from '@mira/shared';
import { renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { KanbanBoard } from './KanbanBoard';

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
    status: 'TODO',
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
  server.use(http.get(BOARD_URL, () => HttpResponse.json<BoardResponse>({ items })));
}

/** Lista de tarjetas de una columna, buscada por su nombre accesible. */
function tarjetasDe(status: (typeof BOARD_STATUSES)[number]) {
  return screen.getByRole('list', { name: `Tarjetas de ${STATUS_LABELS[status]}` });
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
        return HttpResponse.json<BoardResponse>({ items: [] });
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
        return HttpResponse.json<BoardResponse>({ items: [] });
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
    expect(within(tablero).queryByText(STATUS_LABELS.BACKLOG)).not.toBeInTheDocument();
  });

  it('ubica cada tarjeta en la columna de su estado', async () => {
    responderCon([
      itemDePrueba({ id: 'a', reference: 'MIR-1', title: 'Por empezar', status: 'TODO' }),
      itemDePrueba({ id: 'b', reference: 'MIR-2', title: 'Avanzando', status: 'IN_PROGRESS' }),
      itemDePrueba({ id: 'c', reference: 'MIR-3', title: 'Revisando', status: 'IN_REVIEW' }),
      itemDePrueba({ id: 'd', reference: 'MIR-4', title: 'Terminado', status: 'DONE' }),
      itemDePrueba({ id: 'e', reference: 'MIR-5', title: 'Otra mas', status: 'DONE' }),
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
        status: 'IN_PROGRESS',
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
    responderCon([itemDePrueba({ status: 'TODO' })]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    const columna = screen.getByRole('region', { name: /en revision/i });
    const lista = within(columna).getByRole('list', { name: 'Tarjetas de En revision' });
    expect(within(lista).queryAllByRole('listitem')).toHaveLength(0);
    expect(lista).toHaveAttribute('data-status', 'IN_REVIEW');
    expect(within(columna).getByText('Sin elementos')).toBeInTheDocument();
  });

  it('muestra las cuatro columnas aunque el proyecto no tenga items en el tablero', async () => {
    responderCon([]);

    renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('heading', { name: 'Tablero' });

    for (const status of BOARD_STATUSES) {
      expect(tarjetasDe(status)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Sin elementos')).toHaveLength(BOARD_STATUSES.length);
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
        http.get(BOARD_URL, () => HttpResponse.json<BoardResponse>({ items: [...db.values()] })),
        http.patch(STATUS_URL, async ({ params, request }) => {
          const body = (await request.json()) as { status: WorkItemStatus };
          const workItemId = params.workItemId as string;
          peticiones.push({ projectId: params.projectId as string, workItemId, body });
          const item = { ...db.get(workItemId)!, status: body.status };
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
      responderCon([itemDePrueba({ reference: 'MIR-3', title: 'Login', status: 'TODO' })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const menu = await abrirMenuDe(user, 'Login');

      expect(menu).toHaveAccessibleName('Mover MIR-3 a');
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((opcion) => opcion.textContent),
      ).toEqual([STATUS_LABELS.IN_PROGRESS, STATUS_LABELS.IN_REVIEW, STATUS_LABELS.DONE]);
    });

    it('mueve la tarjeta a la columna elegida y el cambio persiste al refrescar', async () => {
      const peticiones = servidorConEstado([
        itemDePrueba({ id: 'item_9', title: 'Login', status: 'TODO' }),
      ]);

      const { user, queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: STATUS_LABELS.IN_REVIEW }));

      expect(within(tarjetasDe('IN_REVIEW')).getByText('Login')).toBeInTheDocument();
      expect(within(tarjetasDe('TODO')).queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      await waitFor(() => expect(peticiones).toHaveLength(1));
      expect(peticiones[0]).toEqual({
        projectId: PROJECT_ID,
        workItemId: 'item_9',
        body: { status: 'IN_REVIEW' },
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
      const item = itemDePrueba({ title: 'Login', status: 'TODO' });
      responderCon([item]);
      server.use(
        http.patch(STATUS_URL, async () => {
          await respuesta;
          return HttpResponse.json({ item: { ...item, status: 'DONE' } });
        }),
      );

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: STATUS_LABELS.DONE }));

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
        const item = itemDePrueba({ reference: 'MIR-3', title: 'Login', status: 'TODO' });
        server.use(
          http.get(BOARD_URL, async () => {
            if (++lecturas > 1) await new Promise(() => {});
            return HttpResponse.json<BoardResponse>({ items: [item] });
          }),
          http.patch(STATUS_URL, respuesta),
        );

        const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
        const menu = await abrirMenuDe(user, 'Login');
        await user.click(within(menu).getByRole('menuitem', { name: STATUS_LABELS.DONE }));

        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('No se pudo mover MIR-3');
        expect(alerta).toHaveTextContent(mensaje);
        expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
        expect(within(tarjetasDe('DONE')).queryByText('Login')).not.toBeInTheDocument();
      },
    );

    it('un movimiento exitoso posterior limpia el error anterior', async () => {
      let fallar = true;
      const item = itemDePrueba({ title: 'Login', status: 'TODO' });
      responderCon([item]);
      server.use(
        http.patch(STATUS_URL, () =>
          fallar
            ? apiError(500, 'INTERNAL_ERROR', 'Error interno del servidor')
            : HttpResponse.json({ item: { ...item, status: 'IN_PROGRESS' } }),
        ),
      );

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      let menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: STATUS_LABELS.DONE }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      fallar = false;
      menu = await abrirMenuDe(user, 'Login');
      await user.click(within(menu).getByRole('menuitem', { name: STATUS_LABELS.IN_PROGRESS }));

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
      responderCon([itemDePrueba({ title: 'Login', status: 'TODO' })]);

      const { queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      await rolResuelto(queryClient, 'success');
      expect(within(tarjeta).queryByRole('button', { name: 'Mover a…' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it.each(['OWNER', 'MEMBER'] as const)('%s ve el menu "Mover a…"', async (role) => {
      conRol(role);
      responderCon([itemDePrueba({ title: 'Login', status: 'TODO' })]);

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
      responderCon([itemDePrueba({ title: 'Login', status: 'TODO' })]);

      const { queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);

      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      await rolResuelto(queryClient, 'error');
      expect(within(tarjeta).queryByRole('button', { name: 'Mover a…' })).not.toBeInTheDocument();
    });

    it('se opera completo con teclado: abre, recorre con flechas y elige', async () => {
      servidorConEstado([itemDePrueba({ title: 'Login', status: 'TODO' })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const tarjeta = await screen.findByRole('article', { name: 'Login' });
      const boton = await within(tarjeta).findByRole('button', { name: 'Mover a…' });
      expect(boton).toHaveAttribute('aria-expanded', 'false');

      boton.focus();
      await user.keyboard('{Enter}');
      expect(boton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menuitem', { name: STATUS_LABELS.IN_PROGRESS })).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: STATUS_LABELS.IN_REVIEW })).toHaveFocus();
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(screen.getByRole('menuitem', { name: STATUS_LABELS.DONE })).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(within(tarjetasDe('DONE')).getByText('Login')).toBeInTheDocument();
    });

    it('Escape cierra el menu sin mover y devuelve el foco al boton', async () => {
      responderCon([itemDePrueba({ title: 'Login', status: 'TODO' })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      await abrirMenuDe(user, 'Login');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mover a…' })).toHaveFocus();
      expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    });

    it('un clic fuera del menu lo cierra sin mover la tarjeta', async () => {
      responderCon([itemDePrueba({ title: 'Login', status: 'TODO' })]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      await abrirMenuDe(user, 'Login');
      await user.click(screen.getByRole('heading', { name: 'Tablero' }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    });
  });
});
