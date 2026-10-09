import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { CommentDto, ProjectRole, WorkItemDto } from '@mira/shared';
import { fireEvent, renderConProviders, screen, waitFor, within } from '@/test/render';
import { apiError, USUARIO_DE_PRUEBA } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { WorkItemDetail } from './WorkItemDetail';

const BASE_URL = 'http://localhost:3000/api';
const PROJECT_ID = 'project_123';
const WORK_ITEM_ID = 'item_456';
const DETAIL_URL = `${BASE_URL}/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}`;
const COMMENTS_URL = `${DETAIL_URL}/comments`;

const item: WorkItemDto = {
  id: WORK_ITEM_ID,
  reference: 'MIR-21',
  projectId: PROJECT_ID,
  title: 'Comentar un elemento de trabajo',
  description: 'Permitir comentarios en un elemento.',
  type: 'STORY',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  estimate: 3,
  dueDate: null,
  assignee: null,
  createdBy: USUARIO_DE_PRUEBA,
  sprintId: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

function comentario(id: string, body: string, createdAt: string): CommentDto {
  return {
    id,
    body,
    author: USUARIO_DE_PRUEBA,
    createdAt,
  };
}

function configurarRol(role: ProjectRole) {
  server.use(
    http.get(`${BASE_URL}/auth/me`, () => HttpResponse.json({ user: USUARIO_DE_PRUEBA })),
    http.get(`${BASE_URL}/projects/*/members`, () =>
      HttpResponse.json({
        members: [
          {
            id: 'membership_other',
            role: 'OWNER',
            user: {
              ...USUARIO_DE_PRUEBA,
              id: 'other_user',
            },
          },
          {
            id: 'membership_123',
            role,
            user: USUARIO_DE_PRUEBA,
          },
        ],
      }),
    ),
  );
}

beforeEach(() => {
  configurarRol('MEMBER');

  server.use(
    http.get(DETAIL_URL, () => HttpResponse.json({ item })),
    http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [] })),
  );
});

describe('MIR-21 - comentarios de elementos de trabajo', () => {
  it('muestra los comentarios con autor, fecha y contenido en orden cronologico', async () => {
    const primero = comentario('comment_1', 'Primer comentario', '2026-10-01T10:00:00.000Z');
    const segundo = comentario('comment_2', 'Segundo comentario', '2026-10-02T11:00:00.000Z');

    server.use(http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [primero, segundo] })));

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(await screen.findByText('Primer comentario')).toBeInTheDocument();
    expect(screen.getByText('Segundo comentario')).toBeInTheDocument();

    const seccion = screen.getByRole('region', { name: 'Comentarios' });
    const entries = within(within(seccion).getByRole('list')).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Primer comentario');
    expect(entries[1]).toHaveTextContent('Segundo comentario');

    // Autor y fecha legible, con el mismo formato que usa la pantalla.
    const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
    expect(entries[0]).toHaveTextContent(USUARIO_DE_PRUEBA.name);
    expect(
      // Intl puede usar espacios finos; RTL los normaliza a un espacio comun.
      within(entries[0]!).getByText(
        fecha.format(new Date('2026-10-01T10:00:00.000Z')).replace(/\s+/g, ' '),
      ),
    ).toBeInTheDocument();
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s puede publicar un comentario y verlo en el historial',
    async (role) => {
      configurarRol(role);

      const comments: CommentDto[] = [];
      const requests: string[] = [];

      server.use(
        http.get(COMMENTS_URL, () => HttpResponse.json({ comments })),
        http.post(COMMENTS_URL, async ({ request }) => {
          const input = (await request.json()) as { body: string };
          requests.push(input.body);

          const created = comentario('comment_new', input.body.trim(), '2026-10-08T15:00:00.000Z');

          comments.push(created);

          return HttpResponse.json({ comment: created }, { status: 201 });
        }),
      );

      const { user } = renderConProviders(
        <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
      );

      const input = await screen.findByRole('textbox', {
        name: 'Escribir comentario',
      });

      await user.type(input, '  Comentario de prueba  ');
      await user.click(screen.getByRole('button', { name: 'Publicar comentario' }));

      expect(await screen.findByText('Comentario de prueba')).toBeInTheDocument();

      await waitFor(() => {
        expect(requests).toEqual(['Comentario de prueba']);
        expect(input).toHaveValue('');
      });
    },
  );

  it('VIEWER puede leer comentarios pero no tiene formulario de publicacion', async () => {
    configurarRol('VIEWER');

    const existing = comentario(
      'comment_viewer',
      'Comentario visible para VIEWER',
      '2026-10-07T12:00:00.000Z',
    );

    let postRequests = 0;

    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [existing] })),
      http.post(COMMENTS_URL, () => {
        postRequests++;
        return apiError(403, 'FORBIDDEN', 'Sin permisos');
      }),
    );

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(await screen.findByText('Comentario visible para VIEWER')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Publicar comentario' })).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('textbox', { name: 'Escribir comentario' })).not.toBeInTheDocument();

    expect(postRequests).toBe(0);
  });

  it('impide publicar comentarios vacios o con solo espacios', async () => {
    let postRequests = 0;

    server.use(
      http.post(COMMENTS_URL, () => {
        postRequests++;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );

    const input = await screen.findByRole('textbox', {
      name: 'Escribir comentario',
    });

    const button = screen.getByRole('button', {
      name: 'Publicar comentario',
    });

    expect(button).toBeDisabled();

    await user.type(input, '   ');

    expect(button).toBeDisabled();

    // Enviar el formulario directamente: el boton deshabilitado no basta como prueba.
    fireEvent.submit(screen.getByRole('form', { name: 'Nuevo comentario' }));

    expect(postRequests).toBe(0);
  });

  it('muestra un error si falla la publicacion y conserva el texto', async () => {
    server.use(
      http.post(COMMENTS_URL, () => apiError(500, 'INTERNAL_ERROR', 'No se pudo publicar')),
    );

    const { user } = renderConProviders(
      <WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />,
    );

    const input = await screen.findByRole('textbox', {
      name: 'Escribir comentario',
    });

    await user.type(input, 'Comentario pendiente');

    await user.click(screen.getByRole('button', { name: 'Publicar comentario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo publicar');

    expect(input).toHaveValue('Comentario pendiente');
  });

  it('muestra el estado vacio cuando no existen comentarios', async () => {
    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    expect(await screen.findByText('Todavía no hay comentarios.')).toBeInTheDocument();
  });

  it.each([
    [404, 'NOT_FOUND', 'Este elemento ya no existe.'],
    [403, 'FORBIDDEN', 'No tienes acceso a los comentarios de este elemento.'],
  ] as const)(
    'ante un %i al cargar comentarios no ofrece reintentar',
    async (status, code, mensaje) => {
      server.use(http.get(COMMENTS_URL, () => apiError(status, code, 'Error')));

      renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

      const seccion = await screen.findByRole('region', { name: 'Comentarios' });
      expect(await within(seccion).findByRole('alert')).toHaveTextContent(mensaje);
      expect(within(seccion).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    },
  );

  it('ante un error del servidor ofrece reintentar', async () => {
    server.use(http.get(COMMENTS_URL, () => apiError(500, 'INTERNAL_ERROR', 'Error inesperado')));

    renderConProviders(<WorkItemDetail projectId={PROJECT_ID} workItemId={WORK_ITEM_ID} />);

    const seccion = await screen.findByRole('region', { name: 'Comentarios' });
    expect(await within(seccion).findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los comentarios.',
    );
    expect(within(seccion).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
