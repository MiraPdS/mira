import type { User } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

/**
 * Puerto de persistencia del modulo auth.
 *
 * El service depende de ESTA interfaz, no de Prisma.  Eso permite dos cosas:
 *  - testear el service con un doble en memoria, sin BD ni vi.mock de modulos;
 *  - pasar una transaccion en vez del cliente global cuando haga falta.
 */
export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: { name: string; email: string; passwordHash: string }): Promise<User>;
}

export function createAuthRepository(db: Db = prisma): AuthRepository {
  return {
    findByEmail: (email) => db.user.findUnique({ where: { email } }),
    findById: (id) => db.user.findUnique({ where: { id } }),
    create: (data) => db.user.create({ data }),
  };
}
