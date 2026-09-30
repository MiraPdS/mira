import bcrypt from 'bcryptjs';
import { env } from '../env.js';

/**
 * Hashing de contrasenas.
 *
 * El costo sale de BCRYPT_ROUNDS: 10 en dev y CI para que la suite no se
 * arrastre, 12 en produccion.  Es configurable justamente porque con 12
 * rondas cada test de registro tardaria ~250ms y una suite de integracion
 * con decenas de usuarios se volveria insoportable.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
