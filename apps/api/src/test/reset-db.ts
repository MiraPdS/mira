import { prisma } from '../lib/prisma.js';

/**
 * Deja la base de pruebas completamente vacia.
 *
 * Se llama en beforeEach: cada test construye el mundo que necesita con las
 * factories y no hereda nada del anterior.  Asi un test no puede depender del
 * orden de ejecucion, que es la causa numero uno de suites intermitentes en
 * CI (y una suite intermitente termina siendo ignorada por el equipo).
 *
 * TRUNCATE ... CASCADE es mucho mas rapido que borrar fila por fila y no
 * pelea con las llaves foraneas.  RESTART IDENTITY deja los contadores en
 * cero para que los ids autoincrementales sean predecibles.
 */
const TABLAS = ['activity_log', 'comments', 'work_items', 'project_members', 'projects', 'users'];

export async function resetDb(): Promise<void> {
  const lista = TABLAS.map((t) => `"public"."${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE;`);
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
