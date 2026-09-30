import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { User } from '@prisma/client';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import type { AuthRepository } from './auth.repository.js';
import { createAuthService, toPublicUser } from './auth.service.js';

/**
 * NIVEL 1 de la piramide: unitario.
 *
 * El service recibe el repositorio por parametro, asi que aqui se le pasa un
 * doble: no hay base de datos, ni HTTP, ni Docker. Corren en milisegundos y
 * funcionan en cualquier maquina recien clonada.
 *
 * Lo que se verifica aqui son las REGLAS: correo duplicado, credenciales
 * incorrectas, que la contrasena nunca se filtre. Que el SQL realmente
 * funcione se verifica en auth.integration.test.ts.
 */

const CORREO = 'ada@mira.dev';
const PASSWORD = 'abcd1234';

async function usuarioDePrueba(overrides: Partial<User> = {}): Promise<User> {
  return {
    id: 'user_1',
    name: 'Ada Lovelace',
    email: CORREO,
    passwordHash: await hashPassword(PASSWORD),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** Devuelve el mensaje del rechazo, y falla si la promesa se resuelve. */
async function mensajeDeRechazo(promesa: Promise<unknown>): Promise<string> {
  return promesa.then(
    () => {
      throw new Error('se esperaba que la promesa fuera rechazada');
    },
    (error: Error) => error.message,
  );
}

describe('authService', () => {
  let repo: MockProxy<AuthRepository>;
  let service: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    repo = mock<AuthRepository>();
    service = createAuthService(repo);
  });

  describe('register', () => {
    it('crea el usuario y devuelve su representacion publica', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockResolvedValue(await usuarioDePrueba());

      const result = await service.register({
        name: 'Ada Lovelace',
        email: CORREO,
        password: PASSWORD,
      });

      expect(result).toEqual({
        id: 'user_1',
        name: 'Ada Lovelace',
        email: CORREO,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('nunca expone el hash de la contrasena en la respuesta', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockResolvedValue(await usuarioDePrueba());

      const result = await service.register({ name: 'Ada', email: CORREO, password: PASSWORD });

      expect(result).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain('$2');
    });

    it('persiste la contrasena hasheada, jamas en texto plano', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockResolvedValue(await usuarioDePrueba());

      await service.register({ name: 'Ada', email: CORREO, password: PASSWORD });

      const args = repo.create.mock.calls[0]?.[0];
      expect(args?.passwordHash).not.toBe(PASSWORD);
      expect(args?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('rechaza con ConflictError si el correo ya esta registrado', async () => {
      repo.findByEmail.mockResolvedValue(await usuarioDePrueba());

      await expect(
        service.register({ name: 'Otra', email: CORREO, password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictError);

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('devuelve el usuario cuando las credenciales son correctas', async () => {
      repo.findByEmail.mockResolvedValue(await usuarioDePrueba());

      await expect(service.login({ email: CORREO, password: PASSWORD })).resolves.toMatchObject({
        email: CORREO,
      });
    });

    it('rechaza cuando la contrasena no coincide', async () => {
      repo.findByEmail.mockResolvedValue(await usuarioDePrueba());

      await expect(
        service.login({ email: CORREO, password: 'incorrecta1' }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rechaza cuando el correo no existe', async () => {
      repo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nadie@mira.dev', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('usa el MISMO mensaje para correo inexistente y para contrasena mala', async () => {
      // Si los mensajes difirieran, cualquiera podria averiguar que correos
      // estan registrados simplemente probando el formulario de login.
      repo.findByEmail.mockResolvedValue(null);
      const porCorreoInexistente = await mensajeDeRechazo(
        service.login({ email: 'nadie@mira.dev', password: PASSWORD }),
      );

      repo.findByEmail.mockResolvedValue(await usuarioDePrueba());
      const porPasswordMala = await mensajeDeRechazo(
        service.login({ email: CORREO, password: 'incorrecta1' }),
      );

      expect(porCorreoInexistente).toBe(porPasswordMala);
    });
  });

  describe('getById', () => {
    it('devuelve el usuario publico', async () => {
      repo.findById.mockResolvedValue(await usuarioDePrueba());
      await expect(service.getById('user_1')).resolves.toMatchObject({ id: 'user_1' });
    });

    it('lanza NotFoundError si el id no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getById('fantasma')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe('toPublicUser', () => {
  it('expone solo id, name, email y createdAt', async () => {
    const user = await usuarioDePrueba();
    expect(Object.keys(toPublicUser(user)).sort()).toEqual(['createdAt', 'email', 'id', 'name']);
  });
});
