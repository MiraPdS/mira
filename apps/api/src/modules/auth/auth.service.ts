import type { User } from '@prisma/client';
import type { LoginInput, PublicUser, RegisterInput } from '@mira/shared';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import type { AuthRepository } from './auth.repository.js';

/**
 * Reglas de negocio de autenticacion.
 *
 * No conoce Express ni Prisma: recibe el repositorio por parametro y lanza
 * errores de dominio.  Por eso se puede testear entero en milisegundos con un
 * doble en memoria, que es la base de la capa unitaria de la piramide.
 */

/** Quita passwordHash y serializa fechas. NUNCA devolver el User crudo. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService(repo: AuthRepository) {
  return {
    async register(input: RegisterInput): Promise<PublicUser> {
      const existente = await repo.findByEmail(input.email);
      if (existente) {
        // Se revela que el correo esta tomado porque es inevitable en un
        // registro (el usuario necesita saber por que fallo). En LOGIN, en
        // cambio, el mensaje es deliberadamente generico.
        throw new ConflictError('Ya existe una cuenta con ese correo', 'EMAIL_TAKEN');
      }

      const passwordHash = await hashPassword(input.password);
      const user = await repo.create({
        name: input.name,
        email: input.email,
        passwordHash,
      });

      return toPublicUser(user);
    },

    async login(input: LoginInput): Promise<PublicUser> {
      const user = await repo.findByEmail(input.email);

      if (!user) {
        // Se compara igual contra un hash ficticio para que responder a un
        // correo inexistente tarde lo mismo que a uno existente. Sin esto, el
        // tiempo de respuesta permite enumerar que correos estan registrados.
        await verifyPassword(input.password, HASH_FICTICIO);
        throw new UnauthorizedError('Correo o contrasena incorrectos', 'INVALID_CREDENTIALS');
      }

      const valida = await verifyPassword(input.password, user.passwordHash);
      if (!valida) {
        throw new UnauthorizedError('Correo o contrasena incorrectos', 'INVALID_CREDENTIALS');
      }

      return toPublicUser(user);
    },

    async getById(id: string): Promise<PublicUser> {
      const user = await repo.findById(id);
      if (!user) throw new NotFoundError('Usuario', 'USER_NOT_FOUND');
      return toPublicUser(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** Hash bcrypt valido de una cadena arbitraria. Solo sirve para gastar tiempo. */
const HASH_FICTICIO = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
