import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type {
  CreateSprintInput,
  ProjectRole,
  SprintListItemDto,
  UpdateSprintInput,
} from '@mira/shared';
import { renderConProviders, screen, within } from '@/test/render';
import { apiError, proyectoDePrueba } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { ProjectSprintsPage } from './ProjectSprintsPage';

const PROJECT_ID = 'project_123';
const PROJECT_URL = `http://localhost:3000/api/projects/${PROJECT_ID}`;
const SPRINTS_URL = `${PROJECT_URL}/sprints`;

function sprintDePrueba(overrides: Partial<SprintListItemDto> = {}): SprintListItemDto {
  return {
    id: 'sprint_1',
    projectId: PROJECT_ID,
    name: 'Sprint 1',
    goal: null,
    startDate: '2026-11-02',
    endDate: '2026-11-13',
    status: 'PLANNED',
    committedPoints: null,
    completedPoints: null,
    createdAt: '2026-10-29T12:00:00.000Z',
    updatedAt: '2026-10-29T12:00:00.000Z',
    items: 0,
    points: 0,
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

/** Lista en memoria: GET devuelve su estado actual, como lo haria la API. */
function conSprints(sprints: SprintListItemDto[]) {
  server.use(http.get(SPRINTS_URL, () => HttpResponse.json({ data: sprints })));
  return sprints;
}

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/sprints" element={<ProjectSprintsPage />} />
    </Routes>,
    { route: `/proyectos/${PROJECT_ID}/sprints` },
  );
}

describe('ProjectSprintsPage', () => {
  beforeEach(() => {
    conRol('OWNER');
    conSprints([]);
  });

  it('muestra el sprint activo arriba, luego los planificados y al final los cerrados', async () => {
    // La API ordena por fecha de inicio; la pantalla agrupa por estado.
    conSprints([
      sprintDePrueba({
        id: 's1',
        name: 'Sprint cerrado',
        status: 'CLOSED',
        committedPoints: null,
        completedPoints: null,
        startDate: '2026-09-01',
        endDate: '2026-09-14',
      }),
      sprintDePrueba({
        id: 's2',
        name: 'Sprint activo',
        status: 'ACTIVE',
        committedPoints: null,
        completedPoints: null,
        startDate: '2026-10-01',
        endDate: '2026-10-14',
        items: 3,
        points: 8,
      }),
      sprintDePrueba({
        id: 's3',
        name: 'Planificado B',
        status: 'PLANNED',
        committedPoints: null,
        completedPoints: null,
        startDate: '2026-11-15',
        endDate: '2026-11-28',
      }),
      sprintDePrueba({
        id: 's4',
        name: 'Planificado A',
        status: 'PLANNED',
        committedPoints: null,
        completedPoints: null,
        startDate: '2026-11-01',
        endDate: '2026-11-14',
      }),
    ]);
    renderPagina();

    await screen.findByRole('heading', { name: 'Sprint activo', level: 2 });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Sprint activo',
      'Planificados',
      'Cerrados',
    ]);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Sprint activo',
      'Planificado A',
      'Planificado B',
      'Sprint cerrado',
    ]);

    const activo = screen.getByRole('article', { name: 'Sprint activo' });
    expect(within(activo).getByText('3 elementos · 8 puntos')).toBeInTheDocument();
    expect(within(activo).getByText(/^Activo · /)).toBeInTheDocument();
  });

  it('sin sprints muestra un estado vacio', async () => {
    renderPagina();

    expect(
      await screen.findByText('Aun no hay sprints. Crea el primero para planificar el trabajo.'),
    ).toBeInTheDocument();
  });

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s crea un sprint y aparece en la lista sin recargar',
    async (role) => {
      conRol(role);
      const sprints = conSprints([sprintDePrueba()]);
      const posts: CreateSprintInput[] = [];
      server.use(
        http.post(SPRINTS_URL, async ({ request }) => {
          const input = (await request.json()) as CreateSprintInput;
          posts.push(input);
          const sprint = sprintDePrueba({
            id: 'sprint_2',
            name: input.name,
            goal: input.goal ?? null,
            startDate: input.startDate,
            endDate: input.endDate,
          });
          sprints.push(sprint);
          const { items: _items, points: _points, ...dto } = sprint;
          return HttpResponse.json({ sprint: dto }, { status: 201 });
        }),
      );
      const { user } = renderPagina();
      await screen.findByRole('article', { name: 'Sprint 1' });

      await user.click(screen.getByRole('button', { name: '+ Crear sprint' }));
      const form = screen.getByRole('form', { name: 'Crear sprint' });
      await user.type(within(form).getByLabelText('Nombre'), '  Sprint 2  ');
      await user.type(within(form).getByLabelText('Objetivo (opcional)'), 'Cerrar MIR-44');
      await user.type(within(form).getByLabelText('Fecha de inicio'), '2026-11-16');
      await user.type(within(form).getByLabelText('Fecha de termino'), '2026-11-27');
      await user.click(within(form).getByRole('button', { name: 'Crear sprint' }));

      expect(await screen.findByRole('article', { name: 'Sprint 2' })).toBeInTheDocument();
      expect(screen.getByRole('article', { name: 'Sprint 1' })).toBeInTheDocument();
      expect(screen.queryByRole('form', { name: 'Crear sprint' })).not.toBeInTheDocument();
      expect(posts).toEqual([
        { name: 'Sprint 2', goal: 'Cerrar MIR-44', startDate: '2026-11-16', endDate: '2026-11-27' },
      ]);
    },
  );

  it.each(['OWNER', 'MEMBER'] as const)(
    '%s edita un sprint, envia solo lo que cambio y la lista se actualiza',
    async (role) => {
      conRol(role);
      const sprints = conSprints([
        sprintDePrueba({ goal: 'Objetivo inicial', items: 2, points: 5 }),
      ]);
      const patches: UpdateSprintInput[] = [];
      server.use(
        http.patch(`${SPRINTS_URL}/sprint_1`, async ({ request }) => {
          const input = (await request.json()) as UpdateSprintInput;
          patches.push(input);
          // La API guarda el cambio: el refetch posterior ya lo ve.
          const actualizado = { ...sprints[0]!, ...input } as SprintListItemDto;
          sprints[0] = actualizado;
          const { items: _items, points: _points, ...dto } = actualizado;
          return HttpResponse.json({ sprint: dto });
        }),
      );
      const { user } = renderPagina();

      await user.click(await screen.findByRole('button', { name: 'Editar Sprint 1' }));
      const form = screen.getByRole('form', { name: 'Editar Sprint 1' });
      const nombre = within(form).getByLabelText('Nombre');
      expect(nombre).toHaveValue('Sprint 1');
      expect(within(form).getByLabelText('Fecha de inicio')).toHaveValue('2026-11-02');
      await user.clear(nombre);
      await user.type(nombre, 'Sprint renombrado');
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }));

      const fila = await screen.findByRole('article', { name: 'Sprint renombrado' });
      expect(within(fila).getByText('2 elementos · 5 puntos')).toBeInTheDocument();
      expect(patches).toEqual([{ name: 'Sprint renombrado' }]);
    },
  );

  it('editar sin cambios cierra el formulario sin enviar nada', async () => {
    conSprints([sprintDePrueba()]);
    let patches = 0;
    server.use(
      http.patch(`${SPRINTS_URL}/sprint_1`, () => {
        patches += 1;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Editar Sprint 1' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('article', { name: 'Sprint 1' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(patches).toBe(0);
  });

  it('VIEWER ve la lista pero no los botones de crear ni editar', async () => {
    conRol('VIEWER');
    conSprints([
      sprintDePrueba(),
      sprintDePrueba({ id: 's2', name: 'Sprint activo', status: 'ACTIVE' }),
    ]);
    renderPagina();

    expect(await screen.findByRole('article', { name: 'Sprint 1' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Sprint activo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear sprint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('valida el nombre en el cliente y muestra el error junto al campo, sin enviar', async () => {
    let posts = 0;
    server.use(
      http.post(SPRINTS_URL, () => {
        posts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: '+ Crear sprint' }));
    const form = screen.getByRole('form', { name: 'Crear sprint' });
    await user.type(within(form).getByLabelText('Nombre'), 'S1');
    await user.type(within(form).getByLabelText('Fecha de inicio'), '2026-11-02');
    await user.type(within(form).getByLabelText('Fecha de termino'), '2026-11-13');
    await user.click(within(form).getByRole('button', { name: 'Crear sprint' }));

    const nombre = within(form).getByLabelText('Nombre');
    expect(nombre).toHaveAttribute('aria-invalid', 'true');
    expect(nombre).toHaveAccessibleDescription('El nombre debe tener al menos 3 caracteres');
    expect(within(form).getByLabelText('Fecha de termino')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(posts).toBe(0);
  });

  it('una fecha de termino anterior al inicio se marca en endDate, sin enviar', async () => {
    let posts = 0;
    server.use(
      http.post(SPRINTS_URL, () => {
        posts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: '+ Crear sprint' }));
    const form = screen.getByRole('form', { name: 'Crear sprint' });
    await user.type(within(form).getByLabelText('Nombre'), 'Sprint 1');
    await user.type(within(form).getByLabelText('Fecha de inicio'), '2026-11-20');
    await user.type(within(form).getByLabelText('Fecha de termino'), '2026-11-10');
    await user.click(within(form).getByRole('button', { name: 'Crear sprint' }));

    const termino = within(form).getByLabelText('Fecha de termino');
    expect(termino).toHaveAttribute('aria-invalid', 'true');
    expect(termino).toHaveAccessibleDescription(
      'La fecha de termino no puede ser anterior a la fecha de inicio',
    );
    expect(within(form).getByLabelText('Fecha de inicio')).toHaveAttribute('aria-invalid', 'false');
    expect(posts).toBe(0);
  });

  it('un 422 del servidor se muestra junto al campo que indica', async () => {
    server.use(
      http.post(SPRINTS_URL, () =>
        apiError(422, 'VALIDATION_ERROR', 'Datos invalidos', {
          endDate: ['La fecha de termino no puede ser anterior a la fecha de inicio'],
        }),
      ),
    );
    const { user } = renderPagina();

    await user.click(await screen.findByRole('button', { name: '+ Crear sprint' }));
    const form = screen.getByRole('form', { name: 'Crear sprint' });
    await user.type(within(form).getByLabelText('Nombre'), 'Sprint 1');
    await user.type(within(form).getByLabelText('Fecha de inicio'), '2026-11-02');
    await user.type(within(form).getByLabelText('Fecha de termino'), '2026-11-13');
    await user.click(within(form).getByRole('button', { name: 'Crear sprint' }));

    const termino = within(form).getByLabelText('Fecha de termino');
    expect(await within(form).findByText(/no puede ser anterior/)).toBeInTheDocument();
    expect(termino).toHaveAccessibleDescription(
      'La fecha de termino no puede ser anterior a la fecha de inicio',
    );
    // Asignado al campo, no repetido como aviso general.
    expect(within(form).queryByText('Datos invalidos')).not.toBeInTheDocument();
  });

  it('un 403 al cargar el proyecto se informa sin ofrecer reintento', async () => {
    server.use(
      http.get(PROJECT_URL, () => apiError(403, 'FORBIDDEN', 'No perteneces a este proyecto')),
    );
    renderPagina();

    expect(await screen.findByText('No tienes acceso a este proyecto.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear sprint/i })).not.toBeInTheDocument();
  });
});
