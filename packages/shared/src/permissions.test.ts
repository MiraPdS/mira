import { describe, expect, it } from 'vitest';
import { PROJECT_ROLES, type ProjectRole } from './domain.js';
import { can, PERMISSIONS, type Permission, permissionsFor } from './permissions.js';

/**
 * Test de tabla de la matriz de autorizacion.
 *
 * Se declara la matriz esperada de forma INDEPENDIENTE de la implementacion:
 * si alguien afloja un permiso en permissions.ts, este test lo delata en vez
 * de seguirlo.  La tabla generada es ademas la evidencia que va a la Wiki.
 */

type Expectation = Record<Permission, ProjectRole[]>;

/** Roles que DEBEN tener cada permiso. Cualquier otro rol debe recibir false. */
const EXPECTED: Expectation = {
  'project:view': ['OWNER', 'MEMBER', 'VIEWER'],
  'project:update': ['OWNER'],
  'project:delete': ['OWNER'],
  'member:invite': ['OWNER'],
  'member:change-role': ['OWNER'],
  'member:remove': ['OWNER'],
  'work-item:view': ['OWNER', 'MEMBER', 'VIEWER'],
  'work-item:create': ['OWNER', 'MEMBER'],
  'work-item:update': ['OWNER', 'MEMBER'],
  'work-item:delete': ['OWNER', 'MEMBER'],
  'work-item:change-status': ['OWNER', 'MEMBER'],
  'comment:create': ['OWNER', 'MEMBER'],
};

describe('can()', () => {
  describe.each(PERMISSIONS)('permiso "%s"', (permission) => {
    it.each(PROJECT_ROLES)('rol %s', (role) => {
      const expected = EXPECTED[permission].includes(role);
      expect(can(role, permission)).toBe(expected);
    });
  });

  it('niega todo a quien no es miembro del proyecto (null)', () => {
    for (const permission of PERMISSIONS) {
      expect(can(null, permission)).toBe(false);
    }
  });

  it('niega todo cuando el rol es undefined', () => {
    for (const permission of PERMISSIONS) {
      expect(can(undefined, permission)).toBe(false);
    }
  });

  it('VIEWER es estrictamente de solo lectura', () => {
    const escrituras = PERMISSIONS.filter((p) => !p.endsWith(':view'));
    for (const permission of escrituras) {
      expect(can('VIEWER', permission)).toBe(false);
    }
  });

  it('OWNER puede todo lo declarado', () => {
    for (const permission of PERMISSIONS) {
      expect(can('OWNER', permission)).toBe(true);
    }
  });

  it('MEMBER no puede administrar el proyecto ni el equipo', () => {
    const administrativos: Permission[] = [
      'project:update',
      'project:delete',
      'member:invite',
      'member:change-role',
      'member:remove',
    ];
    for (const permission of administrativos) {
      expect(can('MEMBER', permission)).toBe(false);
    }
  });
});

describe('permissionsFor()', () => {
  it('devuelve arreglo vacio si no hay rol', () => {
    expect(permissionsFor(null)).toEqual([]);
  });

  it('cada permiso devuelto es coherente con can()', () => {
    for (const role of PROJECT_ROLES) {
      const otorgados = permissionsFor(role);
      for (const permission of PERMISSIONS) {
        expect(otorgados.includes(permission)).toBe(can(role, permission));
      }
    }
  });

  it('los permisos de VIEWER son subconjunto de MEMBER, y los de MEMBER de OWNER', () => {
    const viewer = new Set(permissionsFor('VIEWER'));
    const member = new Set(permissionsFor('MEMBER'));
    const owner = new Set(permissionsFor('OWNER'));

    for (const p of viewer) expect(member.has(p)).toBe(true);
    for (const p of member) expect(owner.has(p)).toBe(true);
  });
});
