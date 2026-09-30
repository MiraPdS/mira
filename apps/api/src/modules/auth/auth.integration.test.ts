import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createUser, PASSWORD_DE_PRUEBA } from '../../test/factories.js';
import { prisma } from '../../lib/prisma.js';

/**
 * NIVEL 2 de la piramide: integracion.
 *
 * Supertest golpea la app Express REAL (middlewares, validacion Zod, Prisma y
 * Postgres de verdad en el puerto 5443). Aqui se verifica lo que el unitario
 * no puede: codigos de estado, la cookie httpOnly, la restriccion unica de
 * correo en la base y que los datos queden realmente persistidos.
 *
 * La base se vacia antes de CADA test (setup-integration.ts), asi que cada
 * test declara su propio mundo y el orden de ejecucion no importa.
 *
 * Requiere:  npm run db:up
 */

let app: Express;

beforeAll(async () => {
  // Import dinamico: la app lee `env`, que debe estar configurado por el
  // setupFile antes de que este modulo se evalue.
  const { createApp } = await import('../../app.js');
  app = createApp();
});

/** Extrae la cookie de sesion de la respuesta, o undefined si no vino. */
function cookieDeSesion(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((c) => c.startsWith('mira_token='));
}

const NUEVO_USUARIO = {
  name: 'Ada Lovelace',
  email: 'ada@mira.dev',
  password: 'abcd1234',
};

describe('POST /api/auth/register', () => {
  it('registra al usuario, responde 201 y deja la sesion iniciada', async () => {
    const res = await request(app).post('/api/auth/register').send(NUEVO_USUARIO);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@mira.dev' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = cookieDeSesion(res);
    expect(cookie).toBeDefined();
    // HttpOnly es la razon por la que elegimos cookie sobre localStorage:
    // si esto se rompiera, un XSS podria leer el token.
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('persiste el usuario en la base con la contrasena hasheada', async () => {
    await request(app).post('/api/auth/register').send(NUEVO_USUARIO).expect(201);

    const guardado = await prisma.user.findUnique({ where: { email: 'ada@mira.dev' } });
    expect(guardado).not.toBeNull();
    expect(guardado?.passwordHash).not.toBe(NUEVO_USUARIO.password);
    expect(guardado?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('normaliza el correo a minusculas antes de guardarlo', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...NUEVO_USUARIO, email: '  ADA@Mira.DEV  ' })
      .expect(201);

    expect(await prisma.user.findUnique({ where: { email: 'ada@mira.dev' } })).not.toBeNull();
  });

  it('responde 409 si el correo ya esta registrado', async () => {
    await createUser({ email: 'ada@mira.dev' });

    const res = await request(app).post('/api/auth/register').send(NUEVO_USUARIO);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['correo invalido', { ...NUEVO_USUARIO, email: 'no-es-correo' }, 'email'],
    ['contrasena corta', { ...NUEVO_USUARIO, password: 'ab1' }, 'password'],
    ['nombre muy corto', { ...NUEVO_USUARIO, name: 'A' }, 'name'],
  ])('responde 422 con el campo en falta: %s', async (_caso, payload, campo) => {
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(campo);
  });

  it('no crea nada en la base cuando la validacion falla', async () => {
    await request(app).post('/api/auth/register').send({ email: 'roto' }).expect(422);

    expect(await prisma.user.count()).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  it('responde 200 y entrega la cookie de sesion con credenciales validas', async () => {
    const user = await createUser({ email: 'ada@mira.dev' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD_DE_PRUEBA });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(cookieDeSesion(res)).toMatch(/HttpOnly/i);
  });

  it('responde 401 con contrasena incorrecta y sin entregar cookie', async () => {
    await createUser({ email: 'ada@mira.dev' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@mira.dev', password: 'incorrecta1' });

    expect(res.status).toBe(401);
    expect(cookieDeSesion(res)).toBeUndefined();
  });

  it('responde 401 con el mismo mensaje cuando el correo no existe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fantasma@mira.dev', password: 'abcd1234' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me', () => {
  it('responde 401 sin cookie de sesion', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responde 401 si la cookie trae un token corrupto', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'mira_token=token-invalido');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('devuelve el usuario autenticado usando la cookie del login', async () => {
    const user = await createUser({ email: 'ada@mira.dev' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD_DE_PRUEBA });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookieDeSesion(login)!);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});

describe('POST /api/auth/logout', () => {
  it('borra la cookie y deja /me inaccesible', async () => {
    const user = await createUser({ email: 'ada@mira.dev' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD_DE_PRUEBA });

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieDeSesion(login)!);

    expect(logout.status).toBe(204);
    // La cookie de borrado llega vacia y con expiracion en el pasado.
    expect(cookieDeSesion(logout)).toMatch(/mira_token=;/);

    const despues = await request(app).get('/api/auth/me').set('Cookie', cookieDeSesion(logout)!);
    expect(despues.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('responde ok sin requerir autenticacion', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('rutas inexistentes', () => {
  it('responden 404 con la forma de error estandar', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
