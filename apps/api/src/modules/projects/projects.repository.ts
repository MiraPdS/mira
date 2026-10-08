import type { Project, ProjectRole } from '@prisma/client';
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
  /** Membresias del usuario con su proyecto, ordenadas por nombre del proyecto. */
  listMembershipsOf(userId: string): Promise<Array<{ role: ProjectRole; project: Project }>>;
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
    // Se parte de la membresia, no del proyecto: un proyecto ajeno no puede
    // colarse en la lista porque nunca entra en la consulta.
    listMembershipsOf: (userId) =>
      db.projectMember.findMany({
        where: { userId },
        include: { project: true },
        orderBy: { project: { name: 'asc' } },
      }),
  };
}
