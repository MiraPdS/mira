import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  BOARD_STATUSES,
  STATUS_LABELS,
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
 * MIR-20: arrastrar y soltar tarjetas entre columnas.
 *
 * Se ejecuta dnd-kit real (PointerSensor y KeyboardSensor) con los eventos que
 * genera user-event. Lo unico simulado, ademas de la API con MSW, es el
 * layout: jsdom no calcula posiciones, asi que `getBoundingClientRect` ubica
 * las columnas una al lado de la otra (300 px cada una) y cada tarjeta dentro
 * de la suya. Asi dnd-kit decide el destino igual que en el navegador.
 */

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const BOARD_URL = `${BASE_URL}/projects/:projectId/board`;
const STATUS_URL = `${BASE_URL}/projects/:projectId/work-items/:workItemId/status`;

const ANCHO_COLUMNA = 300;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

/** Posicion simulada de un elemento segun la columna que lo contiene. */
function layoutSimulado(this: Element): DOMRect {
  const columna = this.closest('section[aria-labelledby^="columna-"]');
  if (!columna) return rect(0, 0, 0, 0);

  const status = columna.getAttribute('aria-labelledby')!.replace('columna-', '');
  const left = BOARD_STATUSES.indexOf(status as (typeof BOARD_STATUSES)[number]) * ANCHO_COLUMNA;
  if (this === columna) return rect(left, 0, ANCHO_COLUMNA - 12, 600);
  return rect(left + 12, 60, ANCHO_COLUMNA - 36, 80);
}

/** Centro de la columna de un estado, en coordenadas de la ventana. */
function centroDe(status: (typeof BOARD_STATUSES)[number]) {
  return { clientX: BOARD_STATUSES.indexOf(status) * ANCHO_COLUMNA + 140, clientY: 300 };
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(layoutSimulado);
  conRol('MEMBER');
});

afterEach(() => vi.restoreAllMocks());

function conRol(role: ProjectRole) {
  server.use(
    http.get(`${BASE_URL}/auth/me`, () => HttpResponse.json({ user: USUARIO_DE_PRUEBA })),
    http.get(`${BASE_URL}/projects/:projectId/members`, () =>
      HttpResponse.json({ members: [{ id: 'membership_1', role, user: USUARIO_DE_PRUEBA }] }),
    ),
  );
}

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_1',
    reference: 'MIR-3',
    projectId: PROJECT_ID,
    title: 'Login',
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

/** Servidor con estado: el PATCH cambia lo que devuelve el GET siguiente. */
function servidorConEstado(items: WorkItemDto[]) {
  const db = new Map(items.map((item) => [item.id, item]));
  const peticiones: { workItemId: string; body: unknown }[] = [];
  server.use(
    http.get(BOARD_URL, () => HttpResponse.json<BoardResponse>({ items: [...db.values()] })),
    http.patch(STATUS_URL, async ({ params, request }) => {
      const body = (await request.json()) as { status: WorkItemStatus };
      const workItemId = params.workItemId as string;
      peticiones.push({ workItemId, body });
      const item = { ...db.get(workItemId)!, status: body.status };
      db.set(workItemId, item);
      return HttpResponse.json({ item });
    }),
  );
  return peticiones;
}

function tarjetasDe(status: (typeof BOARD_STATUSES)[number]) {
  return screen.getByRole('list', { name: `Tarjetas de ${STATUS_LABELS[status]}` });
}

type User = ReturnType<typeof renderConProviders>['user'];

/** Arrastra con el raton desde la tarjeta hasta el centro de una columna. */
async function arrastrar(user: User, titulo: string, destino: (typeof BOARD_STATUSES)[number]) {
  const tarjeta = await screen.findByRole('article', { name: titulo });
  const { left, top } = tarjeta.getBoundingClientRect();
  const inicio = { clientX: left + 20, clientY: top + 20 };
  const fin = centroDe(destino);

  await user.pointer([
    { keys: '[MouseLeft>]', target: tarjeta, coords: inicio },
    // Primero supera la distancia minima de activacion, luego llega al destino.
    { coords: { clientX: inicio.clientX + 10, clientY: inicio.clientY } },
    { coords: fin },
    { keys: '[/MouseLeft]', coords: fin },
  ]);
}

describe('KanbanBoard: arrastrar y soltar (MIR-20)', () => {
  it('al soltar en otra columna la tarjeta cambia de estado y persiste', async () => {
    const peticiones = servidorConEstado([itemDePrueba({ id: 'item_9' })]);

    const { user, queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('button', { name: 'Arrastrar MIR-3' });
    await arrastrar(user, 'Login', 'DONE');

    expect(await within(tarjetasDe('DONE')).findByText('Login')).toBeInTheDocument();
    expect(within(tarjetasDe('TODO')).queryByText('Login')).not.toBeInTheDocument();
    await waitFor(() => expect(peticiones).toHaveLength(1));
    expect(peticiones[0]).toEqual({ workItemId: 'item_9', body: { status: 'DONE' } });

    await queryClient.resetQueries({ queryKey: ['board', PROJECT_ID] });
    expect(
      await within(await screen.findByRole('list', { name: 'Tarjetas de Hecho' })).findByText(
        'Login',
      ),
    ).toBeInTheDocument();
  });

  it('mueve la tarjeta de inmediato, antes de que responda la API', async () => {
    let responder!: () => void;
    const respuesta = new Promise<void>((resolve) => {
      responder = resolve;
    });
    const item = itemDePrueba();
    server.use(
      http.get(BOARD_URL, () => HttpResponse.json<BoardResponse>({ items: [item] })),
      http.patch(STATUS_URL, async () => {
        await respuesta;
        return HttpResponse.json({ item: { ...item, status: 'IN_PROGRESS' } });
      }),
    );

    const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('button', { name: 'Arrastrar MIR-3' });
    await arrastrar(user, 'Login', 'IN_PROGRESS');

    expect(await within(tarjetasDe('IN_PROGRESS')).findByText('Login')).toBeInTheDocument();
    responder();
  });

  it('si el servidor rechaza el cambio, la tarjeta regresa a su columna y se informa', async () => {
    // Solo la primera lectura responde: la tarjeta vuelve por el rollback de
    // la mutacion, no por un refresco del tablero.
    let lecturas = 0;
    server.use(
      http.get(BOARD_URL, async () => {
        if (++lecturas > 1) await new Promise(() => {});
        return HttpResponse.json<BoardResponse>({ items: [itemDePrueba()] });
      }),
      http.patch(STATUS_URL, () => apiError(500, 'INTERNAL_ERROR', 'Error interno del servidor')),
    );

    const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('button', { name: 'Arrastrar MIR-3' });
    await arrastrar(user, 'Login', 'DONE');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo mover MIR-3');
    expect(alerta).toHaveTextContent(/error interno del servidor/i);
    expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    expect(within(tarjetasDe('DONE')).queryByText('Login')).not.toBeInTheDocument();
  });

  it('soltar en la misma columna no llama a la API', async () => {
    const peticiones = servidorConEstado([itemDePrueba()]);

    const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await screen.findByRole('button', { name: 'Arrastrar MIR-3' });
    await arrastrar(user, 'Login', 'TODO');

    expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    expect(peticiones).toHaveLength(0);
  });

  it('un clic en la tarjeta no la arrastra y "Mover a…" sigue funcionando', async () => {
    const peticiones = servidorConEstado([itemDePrueba()]);

    const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    const tarjeta = await screen.findByRole('article', { name: 'Login' });
    await user.click(tarjeta);
    await user.click(await within(tarjeta).findByRole('button', { name: 'Mover a…' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(peticiones).toHaveLength(0);
  });

  describe('con teclado', () => {
    async function tomarConTeclado(user: User) {
      const asa = await screen.findByRole('button', { name: 'Arrastrar MIR-3' });
      asa.focus();
      await user.keyboard(' ');
      return asa;
    }

    it('Espacio toma la tarjeta, las flechas cambian de columna y Espacio la suelta', async () => {
      const peticiones = servidorConEstado([itemDePrueba()]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      await tomarConTeclado(user);
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowLeft}');
      await user.keyboard(' ');

      expect(await within(tarjetasDe('IN_REVIEW')).findByText('Login')).toBeInTheDocument();
      await waitFor(() => expect(peticiones).toHaveLength(1));
      expect(peticiones[0]?.body).toEqual({ status: 'IN_REVIEW' });
    });

    it('anuncia a los lectores de pantalla la columna sobre la que esta la tarjeta', async () => {
      servidorConEstado([itemDePrueba()]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const asa = await tomarConTeclado(user);
      await user.keyboard('{ArrowRight}');

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('MIR-3 esta sobre En progreso.'),
      );
      expect(asa).toHaveAccessibleDescription(/flechas izquierda y derecha/i);

      // Sin soltarla, los listeners del KeyboardSensor quedarian en `window`
      // y el siguiente test heredaria el arrastre.
      await user.keyboard('{Escape}');
    });

    it('Escape cancela: la tarjeta se queda en su columna y no se llama a la API', async () => {
      const peticiones = servidorConEstado([itemDePrueba()]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      await tomarConTeclado(user);
      await user.keyboard('{ArrowRight}{Escape}');

      expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
      expect(peticiones).toHaveLength(0);
    });

    it('Enter en "Mover a…" abre el menu en vez de tomar la tarjeta', async () => {
      servidorConEstado([itemDePrueba()]);

      const { user } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
      const boton = await screen.findByRole('button', { name: 'Mover a…' });
      boton.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('VIEWER no puede arrastrar: la tarjeta no se mueve ni se llama a la API', async () => {
    conRol('VIEWER');
    const peticiones = servidorConEstado([itemDePrueba()]);

    const { user, queryClient } = renderConProviders(<KanbanBoard projectId={PROJECT_ID} />);
    await waitFor(() =>
      expect(queryClient.getQueryState(['projects', PROJECT_ID, 'members'])?.status).toBe(
        'success',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Arrastrar MIR-3' })).not.toBeInTheDocument();

    await arrastrar(user, 'Login', 'DONE');

    expect(within(tarjetasDe('TODO')).getByText('Login')).toBeInTheDocument();
    expect(within(tarjetasDe('DONE')).queryByText('Login')).not.toBeInTheDocument();
    expect(peticiones).toHaveLength(0);
  });
});
