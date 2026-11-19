import path from 'node:path';

/**
 * Usuarios del seed (apps/api/prisma/seed.ts).  Las specs los usan por nombre
 * y nunca escriben un correo a mano (D4):
 *
 *   test.use({ storageState: usuarios.grace.storage });
 *
 * Rol en el proyecto MIR del seed: ada OWNER, alan MEMBER, grace VIEWER.
 */

const PASSWORD_SEED = 'demo1234';

const carpetaSesiones = path.resolve(import.meta.dirname, '../.auth');

function usuario(nombre: string, email: string, rolEnMir: 'OWNER' | 'MEMBER' | 'VIEWER') {
  return {
    nombre,
    email,
    password: PASSWORD_SEED,
    rolEnMir,
    storage: path.join(carpetaSesiones, `${email.split('@')[0]}.json`),
  };
}

export const usuarios = {
  ada: usuario('Ada Lovelace', 'ada@mira.dev', 'OWNER'),
  alan: usuario('Alan Turing', 'alan@mira.dev', 'MEMBER'),
  grace: usuario('Grace Hopper', 'grace@mira.dev', 'VIEWER'),
};

export type UsuarioSeed = (typeof usuarios)[keyof typeof usuarios];

/** Para specs que necesitan un navegador sin sesion (login, registro). */
export const sinSesion = { cookies: [], origins: [] };
