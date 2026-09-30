import { PrismaClient } from '@prisma/client';
import { env, isTest } from '../env.js';

/**
 * Cliente Prisma unico de la aplicacion.
 *
 * En tests apunta a TEST_DATABASE_URL (puerto 5443): la suite de integracion
 * hace TRUNCATE de todas las tablas en cada test, y apuntar por error a la
 * base de desarrollo significaria borrar el trabajo del dia.
 */
const datasourceUrl = isTest && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL;

export const prisma = new PrismaClient({
  datasourceUrl,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** Tipo del cliente aceptado por los repositorios: el cliente o una transaccion. */
export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type Db = PrismaClient | PrismaTx;
