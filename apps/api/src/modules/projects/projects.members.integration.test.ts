import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

import {
  addMember,
  createProject,
  createUser,
  createWorkItem,
  PASSWORD_DE_PRUEBA,
} from '../../test/factories.js';

import { prisma } from '../../lib/prisma.js';

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp();
});

function cookieDeSesion(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((c) => c.startsWith('mira_token='));
}

async function iniciarSesion(email: string): Promise<string> {
  const login = await request(app).post('/api/auth/login').send({
    email,
    password: PASSWORD_DE_PRUEBA,
  });

  expect(login.status).toBe(200);

  const cookie = cookieDeSesion(login);
  expect(cookie).toBeDefined();

  return cookie!;
}

// ============================================================
// MIR-9: Agregar miembros
// ============================================================

describe('POST /api/projects/:projectId/members', () => {
  it('OWNER agrega un usuario registrado y responde 201', async () => {
    const { project, owner } = await createProject();

    const nuevoMiembro = await createUser({
      email: 'nuevo@mira.dev',
    });

    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({
        email: nuevoMiembro.email,
      });

    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({
      projectId: project.id,
      userId: nuevoMiembro.id,
      role: 'MEMBER',
    });

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: nuevoMiembro.id,
          projectId: project.id,
        },
      },
    });

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('MEMBER');
  });

  it('responde 404 si el correo no pertenece a un usuario registrado', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({
        email: 'noexiste@mira.dev',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
    expect(res.body.error.message).toBe('Usuario no encontrado');
  });

  it('responde 409 si el usuario ya es miembro del proyecto', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'miembro@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({
        email: miembro.email,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_ALREADY_EXISTS');
  });

  it('responde 403 si un MEMBER intenta agregar a otra persona', async () => {
    const { project } = await createProject();

    const miembro = await createUser({
      email: 'member@mira.dev',
    });

    const invitado = await createUser({
      email: 'invitado@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(miembro.email);

    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({
        email: invitado.email,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OWNER_REQUIRED');
  });

  it('registra MEMBER_ADDED en el historial al agregar un miembro', async () => {
    const { project, owner } = await createProject();

    const nuevoMiembro = await createUser({
      email: 'historial@mira.dev',
    });

    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({
        email: nuevoMiembro.email,
      })
      .expect(201);

    const activity = await prisma.activityLog.findFirst({
      where: {
        projectId: project.id,
        action: 'MEMBER_ADDED',
      },
    });

    expect(activity).not.toBeNull();
    expect(activity).toMatchObject({
      projectId: project.id,
      actorId: owner.id,
      action: 'MEMBER_ADDED',
      field: 'member',
      toValue: nuevoMiembro.id,
    });
  });

  it('responde 422 si el correo no es valido', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({
        email: 'esto-no-es-un-correo',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('email');
  });
});

// ============================================================
// MIR-9: Listar miembros
// ============================================================

describe('GET /api/projects/:projectId/members', () => {
  it('responde 200 y devuelve los miembros del proyecto', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'listado@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(owner.email);

    const res = await request(app).get(`/api/projects/${project.id}/members`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);

    expect(res.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: owner.id,
          role: 'OWNER',
        }),
        expect.objectContaining({
          userId: miembro.id,
          role: 'MEMBER',
          user: expect.objectContaining({
            id: miembro.id,
            email: miembro.email,
          }),
        }),
      ]),
    );

    // Nunca se deben exponer contraseñas.
    expect(res.body.members[1].user).not.toHaveProperty('passwordHash');
  });

  it('responde 403 si el usuario no pertenece al proyecto', async () => {
    const { project } = await createProject();

    const externo = await createUser({
      email: 'externo@mira.dev',
    });

    const cookie = await iniciarSesion(externo.email);

    const res = await request(app).get(`/api/projects/${project.id}/members`).set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it('muestra al nuevo integrante despues de invitarlo', async () => {
    const { project, owner } = await createProject();

    const invitado = await createUser({
      email: 'listanuevo@mira.dev',
    });

    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({ email: invitado.email })
      .expect(201);

    const res = await request(app)
      .get(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: invitado.id,
          role: 'MEMBER',
          user: expect.objectContaining({
            email: invitado.email,
          }),
        }),
      ]),
    );
  });
});

// ============================================================
// MIR-10: Cambiar rol de miembros
// ============================================================

describe('PATCH /api/projects/:projectId/members/:userId/role - MIR-10', () => {
  it('OWNER cambia MEMBER a VIEWER y registra la actividad', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'rol-viewer@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .patch(`/api/projects/${project.id}/members/${miembro.id}/role`)
      .set('Cookie', cookie)
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('VIEWER');

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: miembro.id,
          projectId: project.id,
        },
      },
    });

    expect(membership?.role).toBe('VIEWER');

    const activity = await prisma.activityLog.findFirst({
      where: {
        projectId: project.id,
        action: 'MEMBER_ROLE_CHANGED',
      },
    });

    expect(activity).toMatchObject({
      actorId: owner.id,
      field: 'role',
      fromValue: 'MEMBER',
      toValue: 'VIEWER',
    });
  });

  it('VIEWER no puede cambiar roles', async () => {
    const { project } = await createProject();

    const viewer = await createUser({
      email: 'viewer-rol@mira.dev',
    });

    const miembro = await createUser({
      email: 'destino-rol@mira.dev',
    });

    await addMember(project, viewer, 'VIEWER');
    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(viewer.email);

    await request(app)
      .patch(`/api/projects/${project.id}/members/${miembro.id}/role`)
      .set('Cookie', cookie)
      .send({ role: 'VIEWER' })
      .expect(403);
  });

  // Nueva prueba: impedir ascender un miembro a OWNER.
  it('no permite ascender un MEMBER a OWNER', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'ascenso-owner@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .patch(`/api/projects/${project.id}/members/${miembro.id}/role`)
      .set('Cookie', cookie)
      .send({ role: 'OWNER' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('role');

    // El rol del miembro no debe cambiar.
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: miembro.id,
          projectId: project.id,
        },
      },
    });

    expect(membership?.role).toBe('MEMBER');

    // No debe registrarse actividad de cambio de rol.
    const activity = await prisma.activityLog.findFirst({
      where: {
        projectId: project.id,
        action: 'MEMBER_ROLE_CHANGED',
      },
    });

    expect(activity).toBeNull();
  });

  it('no permite degradar a un OWNER', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .patch(`/api/projects/${project.id}/members/${owner.id}/role`)
      .set('Cookie', cookie)
      .send({ role: 'MEMBER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWNER_PROTECTED');
  });

  it('responde 404 si el miembro no existe', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .patch(`/api/projects/${project.id}/members/usuario_inexistente/role`)
      .set('Cookie', cookie)
      .send({ role: 'VIEWER' })
      .expect(404);
  });

  it('responde 422 si el rol es invalido', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .patch(`/api/projects/${project.id}/members/${owner.id}/role`)
      .set('Cookie', cookie)
      .send({ role: 'ADMIN' })
      .expect(422);
  });
});

// ============================================================
// MIR-10: Quitar miembros
// ============================================================

describe('DELETE /api/projects/:projectId/members/:userId - MIR-10', () => {
  it('OWNER elimina un MEMBER y registra la actividad', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'eliminar@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .delete(`/api/projects/${project.id}/members/${miembro.id}`)
      .set('Cookie', cookie)
      .expect(204);

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: miembro.id,
          projectId: project.id,
        },
      },
    });

    expect(membership).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        projectId: project.id,
        action: 'MEMBER_REMOVED',
      },
    });

    expect(activity).toMatchObject({
      actorId: owner.id,
      field: 'member',
      fromValue: miembro.id,
    });
  });

  it('VIEWER no puede quitar miembros', async () => {
    const { project } = await createProject();

    const viewer = await createUser({
      email: 'viewer-delete@mira.dev',
    });

    const miembro = await createUser({
      email: 'destino-delete@mira.dev',
    });

    await addMember(project, viewer, 'VIEWER');
    await addMember(project, miembro, 'MEMBER');

    const cookie = await iniciarSesion(viewer.email);

    await request(app)
      .delete(`/api/projects/${project.id}/members/${miembro.id}`)
      .set('Cookie', cookie)
      .expect(403);
  });

  it('no permite eliminar a un OWNER', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    const res = await request(app)
      .delete(`/api/projects/${project.id}/members/${owner.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OWNER_PROTECTED');
  });

  it('responde 404 si el miembro no existe', async () => {
    const { project, owner } = await createProject();
    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .delete(`/api/projects/${project.id}/members/usuario_inexistente`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('desasigna las tareas del miembro eliminado sin borrarlas', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'miembro-tareas@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    // Crear dos tareas asignadas al miembro.
    const tarea1 = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Implementar login',
      assigneeId: miembro.id,
    });

    const tarea2 = await createWorkItem({
      project,
      createdBy: owner,
      title: 'Implementar dashboard',
      assigneeId: miembro.id,
    });

    const cookie = await iniciarSesion(owner.email);

    await request(app)
      .delete(`/api/projects/${project.id}/members/${miembro.id}`)
      .set('Cookie', cookie)
      .expect(204);

    // Las tareas deben seguir existiendo.
    const tareas = await prisma.workItem.findMany({
      where: {
        id: {
          in: [tarea1.id, tarea2.id],
        },
      },
    });

    expect(tareas).toHaveLength(2);

    // Ambas tareas deben quedar sin responsable.
    expect(tareas.every((tarea) => tarea.assigneeId === null)).toBe(true);

    // La membresia debe haber sido eliminada.
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: miembro.id,
          projectId: project.id,
        },
      },
    });

    expect(membership).toBeNull();
  });
});

// ============================================================
// MIR-10: Actualizacion inmediata de permisos
// ============================================================

describe('MIR-10: Actualizacion inmediata de permisos', () => {
  it('MEMBER pierde el permiso de crear tareas al cambiar a VIEWER', async () => {
    const { project, owner } = await createProject();

    const miembro = await createUser({
      email: 'member-permisos@mira.dev',
    });

    await addMember(project, miembro, 'MEMBER');

    const cookieOwner = await iniciarSesion(owner.email);
    const cookieMiembro = await iniciarSesion(miembro.email);

    // El MEMBER puede crear tareas inicialmente.
    const primeraCreacion = await request(app)
      .post(`/api/projects/${project.id}/work-items`)
      .set('Cookie', cookieMiembro)
      .send({
        title: 'Primera tarea del miembro',
      });

    expect(primeraCreacion.status).toBe(201);

    // El OWNER cambia al MEMBER a VIEWER.
    const cambioRol = await request(app)
      .patch(`/api/projects/${project.id}/members/${miembro.id}/role`)
      .set('Cookie', cookieOwner)
      .send({
        role: 'VIEWER',
      });

    expect(cambioRol.status).toBe(200);
    expect(cambioRol.body.member.role).toBe('VIEWER');

    // El mismo usuario intenta crear otra tarea con la misma cookie.
    const segundaCreacion = await request(app)
      .post(`/api/projects/${project.id}/work-items`)
      .set('Cookie', cookieMiembro)
      .send({
        title: 'Segunda tarea del miembro',
      });

    // Debe perder inmediatamente el permiso.
    expect(segundaCreacion.status).toBe(403);

    // Comprobar que solo existe la primera tarea.
    const tareas = await prisma.workItem.findMany({
      where: {
        projectId: project.id,
      },
    });

    expect(tareas).toHaveLength(1);
    expect(tareas[0]?.title).toBe('Primera tarea del miembro');

    // Verificar que el rol persistido es VIEWER.
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: miembro.id,
          projectId: project.id,
        },
      },
    });

    expect(membership?.role).toBe('VIEWER');
  });
});
