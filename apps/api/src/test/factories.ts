import type { Project, ProjectRole, User, WorkItem } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { AUTH_COOKIE, signToken } from '../lib/jwt.js';

/**
 * Factories para los tests de integracion.
 *
 * REGLA DEL EQUIPO: datos deterministas, nada de faker en valores que luego
 * se asertan.  Un test que falla con datos aleatorios no se puede reproducir,
 * y un fallo que no se reproduce se termina marcando como "flaky" y se ignora.
 *
 * Cada factory crea lo minimo y acepta overrides, para que el test declare
 * explicitamente lo unico que le importa:
 *
 *   const user = await createUser({ email: 'ada@mira.dev' });
 */

let contador = 0;
/** Secuencia local y predecible: reinicia en cada archivo de test. */
const siguiente = () => ++contador;

export const PASSWORD_DE_PRUEBA = 'abcd1234';

export async function createUser(
  overrides: Partial<Pick<User, 'name' | 'email'>> & { password?: string } = {},
): Promise<User> {
  const n = siguiente();
  return prisma.user.create({
    data: {
      name: overrides.name ?? `Usuario ${n}`,
      email: overrides.email ?? `usuario${n}@mira.test`,
      passwordHash: await hashPassword(overrides.password ?? PASSWORD_DE_PRUEBA),
    },
  });
}

/**
 * Cabecera Cookie con una sesion valida para `user`, lista para
 * `.set('Cookie', sessionCookie(user))`. Evita pasar por /login en tests que
 * no prueban autenticacion.
 */
export function sessionCookie(user: Pick<User, 'id' | 'email'>): string {
  return `${AUTH_COOKIE}=${signToken({ sub: user.id, email: user.email })}`;
}

export async function createProject(
  options: {
    owner?: User;
    name?: string;
    key?: string;
    description?: string | null;
  } = {},
): Promise<{ project: Project; owner: User }> {
  const owner = options.owner ?? (await createUser());
  const n = siguiente();

  const project = await prisma.project.create({
    data: {
      name: options.name ?? `Proyecto ${n}`,
      key: options.key ?? `P${n}`,
      description: options.description ?? null,
      members: { create: { userId: owner.id, role: 'OWNER' } },
    },
  });

  return { project, owner };
}

export async function addMember(
  project: Project,
  user: User,
  role: ProjectRole = 'MEMBER',
): Promise<void> {
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: user.id, role },
  });
}

export async function createWorkItem(options: {
  project: Project;
  createdBy: User;
  title?: string;
  description?: string | null;
  status?: WorkItem['status'];
  type?: WorkItem['type'];
  priority?: WorkItem['priority'];
  estimate?: WorkItem['estimate'];
  dueDate?: WorkItem['dueDate'];
  assigneeId?: string | null;
}): Promise<WorkItem> {
  const n = siguiente();
  return prisma.workItem.create({
    data: {
      reference: `${options.project.key}-${n}`,
      projectId: options.project.id,
      createdById: options.createdBy.id,
      title: options.title ?? `Item ${n}`,
      description: options.description ?? null,
      status: options.status ?? 'BACKLOG',
      type: options.type ?? 'TASK',
      priority: options.priority ?? 'MEDIUM',
      estimate: options.estimate ?? null,
      dueDate: options.dueDate ?? null,
      assigneeId: options.assigneeId ?? null,
    },
  });
}
