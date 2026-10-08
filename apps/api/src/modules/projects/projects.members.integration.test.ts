import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { addMember, createProject, createUser, PASSWORD_DE_PRUEBA } from '../../test/factories.js';
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

    // Primero invitamos al usuario.
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Cookie', cookie)
      .send({ email: invitado.email })
      .expect(201);

    // Luego consultamos la lista actualizada.
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
