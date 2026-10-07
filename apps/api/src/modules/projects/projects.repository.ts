import type { Project } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

/**
 * Puerto de persistencia del modulo projects.
 *
 * Igual que en auth: el service depende de esta interfaz y no de Prisma, para
 * poder testearlo con un doble en memoria.
 */
export interface ProjectsRepository {
  findByKey(key: string): Promise<Project | null>;
  /** Crea el proyecto y su membresia OWNER en una sola escritura. */
  createWithOwner(
    data: { name: string; key: string; description: string | null },
    ownerId: string,
  ): Promise<Project>;
}

export function createProjectsRepository(db: Db = prisma): ProjectsRepository {
  return {
    findByKey: (key) => db.project.findUnique({ where: { key } }),
    // Escritura anidada: Prisma inserta proyecto y membresia en la misma
    // transaccion, asi que nunca queda un proyecto sin duenio.
    createWithOwner: (data, ownerId) =>
      db.project.create({
        data: { ...data, members: { create: { userId: ownerId, role: 'OWNER' } } },
      }),
  };
}
