import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import type { ProjectDto, ProjectResponse, UpdateProjectInput } from '@mira/shared';
import { renderConProviders, screen } from '@/test/render';
import { server } from '@/test/msw/server';
import { apiError, proyectoDePrueba } from '@/test/msw/handlers';
import { ProjectSettingsPage } from './ProjectSettingsPage';

/**
 * Configuracion del proyecto (MIR-7).
 *
 * El 403 real a MEMBER/VIEWER lo garantiza la API (projects.integration.test.ts);
 * aqui se verifica que la UI no ofrezca "Editar" y que el formulario envie solo
 * lo que cambio.
 */

const BASE_URL = 'http://localhost:3000/api';

function conProyecto(overrides: Partial<ProjectDto> = {}) {
  const project = proyectoDePrueba({ description: 'Antes', ...overrides });
  server.use(
    http.get(`${BASE_URL}/projects/:projectId`, () =>
      HttpResponse.json<ProjectResponse>({ project }),
    ),
  );
  return project;
}

/** Registra los cuerpos de cada PATCH; responde con el proyecto actualizado. */
function capturarPatch(base: ProjectDto) {
  const cuerpos: UpdateProjectInput[] = [];
  server.use(
    http.patch(`${BASE_URL}/projects/:projectId`, async ({ request }) => {
      const cuerpo = (await request.json()) as UpdateProjectInput;
      cuerpos.push(cuerpo);
      return HttpResponse.json<ProjectResponse>({
        // El spread conserva un `description: null` explicito y deja intacto
        // lo que el cuerpo omite.
        project: { ...base, ...cuerpo },
      });
    }),
  );
  return cuerpos;
}

function renderPagina() {
  return renderConProviders(
    <Routes>
      <Route path="/proyectos/:projectId/configuracion" element={<ProjectSettingsPage />} />
    </Routes>,
    { route: '/proyectos/project_1/configuracion' },
  );
}

async function abrirEdicion() {
  const utils = renderPagina();
  await utils.user.click(await screen.findByRole('button', { name: 'Editar' }));
  return utils;
}

describe('ProjectSettingsPage', () => {
  it('muestra nombre, clave, descripcion y rol', async () => {
    conProyecto({ myRole: 'VIEWER' });
    renderPagina();

    expect(await screen.findByText('Mira')).toBeInTheDocument();
    expect(screen.getByText('MIR')).toBeInTheDocument();
    expect(screen.getByText('Antes')).toBeInTheDocument();
    expect(screen.getByText('Observador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver equipo' })).toHaveAttribute(
      'href',
      '/proyectos/project_1/miembros',
    );
  });

  it('el OWNER ve el boton "Editar"', async () => {
    conProyecto({ myRole: 'OWNER' });
    renderPagina();

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it.each(['MEMBER', 'VIEWER'] as const)('CA2: un %s no ve el boton "Editar"', async (myRole) => {
    conProyecto({ myRole });
    renderPagina();

    expect(await screen.findByText('Mira')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('la clave se muestra solo lectura', async () => {
    conProyecto();
    await abrirEdicion();

    expect(screen.getByLabelText('Clave')).toHaveAttribute('readonly');
  });

  it('"Guardar" esta deshabilitado mientras no hay cambios', async () => {
    conProyecto();
    const { user } = await abrirEdicion();
    const guardar = screen.getByRole('button', { name: 'Guardar' });

    expect(guardar).toBeDisabled();

    await user.type(screen.getByLabelText('Nombre'), ' 2');
    expect(guardar).toBeEnabled();
  });

  it('envia solo los campos que cambiaron y vuelve a la vista con los datos nuevos', async () => {
    const cuerpos = capturarPatch(conProyecto());
    const { user } = await abrirEdicion();

    const descripcion = screen.getByLabelText('Descripcion (opcional)');
    await user.clear(descripcion);
    await user.type(descripcion, 'Despues');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados');
    expect(cuerpos).toEqual([{ description: 'Despues' }]);
    expect(screen.getByText('Despues')).toBeInTheDocument();
  });

  it('vaciar la descripcion envia null', async () => {
    const cuerpos = capturarPatch(conProyecto());
    const { user } = await abrirEdicion();

    await user.clear(screen.getByLabelText('Descripcion (opcional)'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByText('Cambios guardados');
    expect(cuerpos).toEqual([{ description: null }]);
    expect(screen.getByText('Sin descripcion')).toBeInTheDocument();
  });

  it('solo espacios agregados al nombre no envian PATCH', async () => {
    const cuerpos = capturarPatch(conProyecto());
    const { user } = await abrirEdicion();

    await user.type(screen.getByLabelText('Nombre'), '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(cuerpos).toEqual([]);
    expect(screen.queryByText('Cambios guardados')).not.toBeInTheDocument();
  });

  it('espacios en una descripcion que ya era null no envian PATCH', async () => {
    const cuerpos = capturarPatch(conProyecto({ description: null }));
    const { user } = await abrirEdicion();

    await user.type(screen.getByLabelText('Descripcion (opcional)'), '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(cuerpos).toEqual([]);
  });

  it('un 422 con campo se muestra bajo ese campo', async () => {
    conProyecto();
    server.use(
      http.patch(`${BASE_URL}/projects/:projectId`, () =>
        apiError(422, 'VALIDATION_ERROR', 'Datos invalidos', { name: ['Nombre no permitido'] }),
      ),
    );
    const { user } = await abrirEdicion();

    await user.type(screen.getByLabelText('Nombre'), ' 2');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Nombre no permitido')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Mira 2');
  });

  it('un 403 al guardar avisa y, tras refrescar el rol, oculta "Editar"', async () => {
    conProyecto({ myRole: 'OWNER' });
    const { user } = await abrirEdicion();

    // Mientras edita, otro OWNER lo deja como MEMBER.
    conProyecto({ myRole: 'MEMBER' });
    server.use(
      http.patch(`${BASE_URL}/projects/:projectId`, () =>
        apiError(403, 'OWNER_REQUIRED', 'Solo el propietario puede editar el proyecto'),
      ),
    );

    await user.type(screen.getByLabelText('Nombre'), ' 2');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya no tienes permisos para editar este proyecto',
    );
    expect(await screen.findByText('Miembro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('"Cancelar" descarta lo escrito y vuelve a la vista', async () => {
    conProyecto();
    const { user } = await abrirEdicion();

    await user.type(screen.getByLabelText('Nombre'), ' 2');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('Mira')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Mira');
  });

  it('a quien no es miembro le avisa que no tiene acceso', async () => {
    server.use(
      http.get(`${BASE_URL}/projects/:projectId`, () =>
        apiError(403, 'PROJECT_ACCESS_DENIED', 'No perteneces a este proyecto'),
      ),
    );
    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes acceso a este proyecto');
  });
});
