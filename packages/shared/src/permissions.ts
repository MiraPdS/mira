import type { ProjectRole } from './domain.js';

/**
 * Autorizacion de Mira: una unica funcion pura.
 *
 * Por que una funcion pura y no middleware disperso:
 *  1. El backend la usa en el middleware de Express para PROTEGER.
 *  2. El frontend la usa para OCULTAR botones que igual fallarian.
 * Al ser la misma funcion, la UI nunca ofrece algo que la API va a rechazar.
 *
 * Al no tocar BD, HTTP ni tiempo, se cubre exhaustivamente con un test de
 * tabla.  Esa matriz rol x accion es evidencia directa para la Wiki.
 *
 * REGLA: ningun endpoint decide permisos por su cuenta.  Todo pasa por aqui.
 */

export const PERMISSIONS = [
  'project:view',
  'project:update',
  'project:delete',
  'member:invite',
  'member:change-role',
  'member:remove',
  'work-item:view',
  'work-item:create',
  'work-item:update',
  'work-item:delete',
  'work-item:change-status',
  'comment:create',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Matriz de autorizacion.
 *
 * OWNER  administra el proyecto, sus miembros y su contenido.
 * MEMBER trabaja: crea, edita y mueve items, comenta. No toca el proyecto ni el equipo.
 * VIEWER solo lee. Ni siquiera comenta (comentar es participar, y eso es de miembros).
 */
const MATRIX: Record<ProjectRole, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([
    'project:view',
    'project:update',
    'project:delete',
    'member:invite',
    'member:change-role',
    'member:remove',
    'work-item:view',
    'work-item:create',
    'work-item:update',
    'work-item:delete',
    'work-item:change-status',
    'comment:create',
  ]),
  MEMBER: new Set<Permission>([
    'project:view',
    'work-item:view',
    'work-item:create',
    'work-item:update',
    'work-item:delete',
    'work-item:change-status',
    'comment:create',
  ]),
  VIEWER: new Set<Permission>(['project:view', 'work-item:view']),
};

/**
 * Responde si un rol puede ejecutar una accion.
 *
 * @param role       Rol del usuario EN ESE PROYECTO, o null/undefined si no es
 *                   miembro.  No-miembro siempre es `false`: el rol vive en
 *                   ProjectMember, no en User, asi que la misma persona puede
 *                   ser OWNER en un proyecto y VIEWER en otro.
 * @param permission Accion a evaluar.
 */
export function can(role: ProjectRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].has(permission);
}

/** Todos los permisos de un rol. Util para enviar las capacidades al frontend. */
export function permissionsFor(role: ProjectRole | null | undefined): Permission[] {
  if (!role) return [];
  return [...MATRIX[role]];
}
