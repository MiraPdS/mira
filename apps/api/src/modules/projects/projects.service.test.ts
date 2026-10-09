import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { Project, ProjectMember, User } from '@prisma/client';

import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { ProjectsRepository } from './projects.repository.js';
import { createProjectsService, diffProject } from './projects.service.js';

/**
 * NIVEL 1 de la piramide: unitario.
 *
 * Se verifican las REGLAS de crear proyecto (clave duplicada, rol OWNER) con
 * un repositorio doble. Que la membresia quede realmente en la base se
 * verifica en projects.integration.test.ts.
 */

function proyectoDePrueba(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project_1',
    name: 'Mira',
    key: 'MIR',
    description: null,
    itemCounter: 0,
    organizationId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function miembroDePrueba(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: 'member_1',
    projectId: 'project_1',
    userId: 'owner_1',
    role: 'OWNER',
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('projectsService', () => {
  let repo: MockProxy<ProjectsRepository>;
  let service: ReturnType<typeof createProjectsService>;

  beforeEach(() => {
    repo = mock<ProjectsRepository>();
    service = createProjectsService(repo);
  });

  describe('create', () => {
    it('crea el proyecto con el usuario como OWNER y devuelve el DTO', async () => {
      repo.findByKey.mockResolvedValue(null);
      repo.createWithOwner.mockResolvedValue(proyectoDePrueba());

      const result = await service.create({ name: 'Mira', key: 'MIR' }, 'user_1');

      expect(repo.createWithOwner).toHaveBeenCalledWith(
        { name: 'Mira', key: 'MIR', description: null },
        'user_1',
      );

      expect(result).toEqual({
        id: 'project_1',
        name: 'Mira',
        key: 'MIR',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        myRole: 'OWNER',
      });
    });

    it('no expone campos internos como itemCounter', async () => {
      repo.findByKey.mockResolvedValue(null);
      repo.createWithOwner.mockResolvedValue(proyectoDePrueba());

      const result = await service.create({ name: 'Mira', key: 'MIR' }, 'user_1');

      expect(result).not.toHaveProperty('itemCounter');
      expect(result).not.toHaveProperty('organizationId');
    });

    it('rechaza con ConflictError si la clave ya existe, sin intentar crear', async () => {
      repo.findByKey.mockResolvedValue(proyectoDePrueba());

      await expect(service.create({ name: 'Otro', key: 'MIR' }, 'user_1')).rejects.toBeInstanceOf(
        ConflictError,
      );

      expect(repo.createWithOwner).not.toHaveBeenCalled();
    });

    it('menciona la clave en conflicto en el mensaje', async () => {
      repo.findByKey.mockResolvedValue(proyectoDePrueba());

      await expect(service.create({ name: 'Otro', key: 'MIR' }, 'user_1')).rejects.toThrow(/MIR/);
    });

    describe('changeMemberRole - MIR-10', () => {
      it('permite a un OWNER cambiar un MEMBER a VIEWER', async () => {
        const miembroActualizado = miembroDePrueba({
          userId: 'user_2',
          role: 'VIEWER',
        });

        repo.findMember
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'owner_1', role: 'OWNER' }))
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'user_2', role: 'MEMBER' }));

        repo.changeMemberRoleWithActivity.mockResolvedValue(miembroActualizado);

        const result = await service.changeMemberRole('project_1', 'owner_1', 'user_2', 'VIEWER');

        expect(result).toEqual(miembroActualizado);

        expect(repo.changeMemberRoleWithActivity).toHaveBeenCalledWith(
          'project_1',
          'user_2',
          'owner_1',
          'VIEWER',
        );
      });

      it.each(['MEMBER', 'VIEWER'] as const)(
        'rechaza a un %s que intenta cambiar roles',
        async (role) => {
          repo.findMember.mockResolvedValue(miembroDePrueba({ role }));

          await expect(
            service.changeMemberRole('project_1', 'actor_1', 'user_2', 'VIEWER'),
          ).rejects.toBeInstanceOf(ForbiddenError);

          expect(repo.changeMemberRoleWithActivity).not.toHaveBeenCalled();
        },
      );

      it('rechaza a un usuario que no pertenece al proyecto', async () => {
        repo.findMember.mockResolvedValue(null);

        await expect(
          service.changeMemberRole('project_1', 'outsider_1', 'user_2', 'VIEWER'),
        ).rejects.toBeInstanceOf(ForbiddenError);

        expect(repo.changeMemberRoleWithActivity).not.toHaveBeenCalled();
      });

      // MIR-10: La protección del último OWNER se realiza en el repositorio.
      it('permite cambiar el rol de un OWNER y delega la protección al repositorio', async () => {
        const miembroActualizado = miembroDePrueba({
          userId: 'owner_2',
          role: 'VIEWER',
        });

        repo.findMember
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'owner_1', role: 'OWNER' }))
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'owner_2', role: 'OWNER' }));

        repo.changeMemberRoleWithActivity.mockResolvedValue(miembroActualizado);

        const result = await service.changeMemberRole('project_1', 'owner_1', 'owner_2', 'VIEWER');

        expect(result).toEqual(miembroActualizado);

        expect(repo.changeMemberRoleWithActivity).toHaveBeenCalledWith(
          'project_1',
          'owner_2',
          'owner_1',
          'VIEWER',
        );
      });

      // MIR-10: Impedir asignar el rol OWNER mediante este endpoint.
      it('rechaza ascender un MEMBER a OWNER', async () => {
        repo.findMember.mockResolvedValueOnce(
          miembroDePrueba({ userId: 'owner_1', role: 'OWNER' }),
        );

        await expect(
          service.changeMemberRole('project_1', 'owner_1', 'user_2', 'OWNER'),
        ).rejects.toBeInstanceOf(ForbiddenError);

        expect(repo.changeMemberRoleWithActivity).not.toHaveBeenCalled();
      });
    });

    describe('removeMember - MIR-10', () => {
      it('permite a un OWNER quitar un miembro', async () => {
        repo.findMember
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'owner_1', role: 'OWNER' }))
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'user_2', role: 'MEMBER' }));

        repo.removeMemberWithActivity.mockResolvedValue(undefined);

        await service.removeMember('project_1', 'owner_1', 'user_2');

        expect(repo.removeMemberWithActivity).toHaveBeenCalledWith(
          'project_1',
          'user_2',
          'owner_1',
        );
      });

      it.each(['MEMBER', 'VIEWER'] as const)(
        'rechaza a un %s que intenta quitar miembros',
        async (role) => {
          repo.findMember.mockResolvedValue(miembroDePrueba({ role }));

          await expect(
            service.removeMember('project_1', 'actor_1', 'user_2'),
          ).rejects.toBeInstanceOf(ForbiddenError);

          expect(repo.removeMemberWithActivity).not.toHaveBeenCalled();
        },
      );

      it('rechaza a un usuario que no pertenece al proyecto', async () => {
        repo.findMember.mockResolvedValue(null);

        await expect(
          service.removeMember('project_1', 'outsider_1', 'user_2'),
        ).rejects.toBeInstanceOf(ForbiddenError);

        expect(repo.removeMemberWithActivity).not.toHaveBeenCalled();
      });

      // MIR-10: El repositorio protege al último OWNER dentro de la transacción.
      it('permite solicitar eliminar a un OWNER y delega la protección al repositorio', async () => {
        repo.findMember
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'owner_1', role: 'OWNER' }))
          .mockResolvedValueOnce(miembroDePrueba({ userId: 'owner_2', role: 'OWNER' }));

        repo.removeMemberWithActivity.mockResolvedValue(undefined);

        await service.removeMember('project_1', 'owner_1', 'owner_2');

        expect(repo.removeMemberWithActivity).toHaveBeenCalledWith(
          'project_1',
          'owner_2',
          'owner_1',
        );
      });
    });
  });

  describe('listForUser', () => {
    it('devuelve un DTO por membresia, cada uno con el rol del usuario', async () => {
      repo.listMembershipsOf.mockResolvedValue([
        { role: 'OWNER', project: proyectoDePrueba({ id: 'p_a', name: 'Alfa', key: 'ALF' }) },
        { role: 'VIEWER', project: proyectoDePrueba({ id: 'p_b', name: 'Beta', key: 'BET' }) },
      ]);

      const result = await service.listForUser('user_1');

      expect(repo.listMembershipsOf).toHaveBeenCalledWith('user_1');

      expect(result.map((p) => [p.id, p.myRole])).toEqual([
        ['p_a', 'OWNER'],
        ['p_b', 'VIEWER'],
      ]);

      expect(result[0]).not.toHaveProperty('itemCounter');
    });

    it('devuelve una lista vacia si el usuario no participa en ningun proyecto', async () => {
      repo.listMembershipsOf.mockResolvedValue([]);

      await expect(service.listForUser('user_1')).resolves.toEqual([]);
    });
  });

  describe('getById - MIR-7', () => {
    it('devuelve el proyecto con el rol del miembro', async () => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role: 'VIEWER' }));
      repo.findById.mockResolvedValue(proyectoDePrueba());

      const result = await service.getById('project_1', 'owner_1');

      expect(result).toMatchObject({ id: 'project_1', myRole: 'VIEWER' });
    });

    it('rechaza con 403 a quien no es miembro, sin leer el proyecto', async () => {
      repo.findMember.mockResolvedValue(null);

      await expect(service.getById('project_1', 'outsider_1')).rejects.toMatchObject({
        status: 403,
        code: 'PROJECT_ACCESS_DENIED',
      });
      expect(repo.findById).not.toHaveBeenCalled();
    });
  });

  describe('delete - MIR-8', () => {
    const proyecto = { id: 'project_1', key: 'MIR', name: 'Mira' };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('el OWNER elimina el proyecto', async () => {
      repo.deleteIfMemberRole.mockResolvedValue({ status: 'deleted', project: proyecto });
      vi.spyOn(console, 'info').mockImplementation(() => {});

      await expect(service.delete('project_1', 'owner_1')).resolves.toBeUndefined();

      expect(repo.deleteIfMemberRole).toHaveBeenCalledWith('project_1', 'owner_1', ['OWNER']);
    });

    it('solo pide borrar si quien llama es OWNER (la matriz de permisos)', async () => {
      repo.deleteIfMemberRole.mockResolvedValue({ status: 'forbidden' });

      await service.delete('project_1', 'user_1').catch(() => undefined);

      expect(repo.deleteIfMemberRole).toHaveBeenCalledWith('project_1', 'user_1', ['OWNER']);
    });

    it('responde 403 OWNER_REQUIRED a quien no es OWNER', async () => {
      repo.deleteIfMemberRole.mockResolvedValue({ status: 'forbidden' });

      await expect(service.delete('project_1', 'user_2')).rejects.toMatchObject({
        status: 403,
        code: 'OWNER_REQUIRED',
      });
    });

    it('responde 404 si el proyecto ya no existe', async () => {
      repo.deleteIfMemberRole.mockResolvedValue({ status: 'not_found' });

      await expect(service.delete('project_1', 'owner_1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deja constancia en el log de quien elimino el proyecto', async () => {
      repo.deleteIfMemberRole.mockResolvedValue({ status: 'deleted', project: proyecto });
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});

      await service.delete('project_1', 'owner_1');

      expect(info).toHaveBeenCalledWith(
        '[auditoria] proyecto eliminado',
        expect.stringContaining('"actorId":"owner_1"'),
      );
    });
  });

  describe('update - MIR-7', () => {
    beforeEach(() => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role: 'OWNER' }));
      // Simula la transaccion: aplica el diff sobre el estado "bloqueado".
      repo.updateWithActivity.mockImplementation(async (_id, data, _actor, diff) => {
        const actual = proyectoDePrueba({ description: 'Antes' });
        diff(actual);
        return { ...actual, ...data };
      });
    });

    it('el OWNER actualiza y recibe el DTO con rol OWNER', async () => {
      const result = await service.update('project_1', 'owner_1', { name: 'Mira 2' });

      expect(repo.updateWithActivity).toHaveBeenCalledWith(
        'project_1',
        { name: 'Mira 2' },
        'owner_1',
        expect.any(Function),
      );
      expect(result).toMatchObject({ name: 'Mira 2', myRole: 'OWNER' });
    });

    it('el diff que pasa al repositorio se calcula contra el estado que este le entrega', async () => {
      await service.update('project_1', 'owner_1', { name: 'Mira', description: 'Despues' });

      const diff = repo.updateWithActivity.mock.calls[0]![3];
      expect(diff(proyectoDePrueba({ description: 'Antes' }))).toEqual([
        { field: 'description', fromValue: 'Antes', toValue: 'Despues' },
      ]);
    });

    it('responde 404 si el proyecto desaparecio antes de bloquearlo', async () => {
      repo.updateWithActivity.mockResolvedValue(null);

      await expect(service.update('project_1', 'owner_1', { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it.each(['MEMBER', 'VIEWER'] as const)('rechaza con 403 a un %s', async (role) => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role }));

      await expect(service.update('project_1', 'user_1', { name: 'X' })).rejects.toMatchObject({
        status: 403,
        code: 'OWNER_REQUIRED',
      });
      expect(repo.updateWithActivity).not.toHaveBeenCalled();
    });

    it('rechaza con 403 a quien no es miembro (o si el proyecto no existe)', async () => {
      repo.findMember.mockResolvedValue(null);

      await expect(service.update('project_1', 'outsider_1', { name: 'X' })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.updateWithActivity).not.toHaveBeenCalled();
    });
  });

  describe('diffProject - MIR-7', () => {
    const actual = proyectoDePrueba({ name: 'Mira', description: 'Antes' });

    it('registra el cambio de nombre', () => {
      expect(diffProject(actual, { name: 'Mira 2' })).toEqual([
        { field: 'name', fromValue: 'Mira', toValue: 'Mira 2' },
      ]);
    });

    it('vaciar la descripcion registra el paso a null', () => {
      expect(diffProject(actual, { description: null })).toEqual([
        { field: 'description', fromValue: 'Antes', toValue: null },
      ]);
    });

    it('solo registra los campos que realmente cambian', () => {
      expect(diffProject(actual, { name: 'Mira', description: 'Despues' })).toEqual([
        { field: 'description', fromValue: 'Antes', toValue: 'Despues' },
      ]);
    });

    it('con los mismos valores no hay cambios', () => {
      expect(diffProject(actual, { name: 'Mira', description: 'Antes' })).toEqual([]);
    });
  });

  describe('getMembers - MIR-9', () => {
    it('permite listar miembros a un integrante del proyecto', async () => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role: 'MEMBER' }));
      repo.findMembersByProject.mockResolvedValue([]);

      const result = await service.getMembers('project_1', 'member_1');

      expect(result).toEqual([]);
      expect(repo.findMembersByProject).toHaveBeenCalledWith('project_1');
    });

    it('rechaza a un usuario que no pertenece al proyecto', async () => {
      repo.findMember.mockResolvedValue(null);

      await expect(service.getMembers('project_1', 'outsider_1')).rejects.toBeInstanceOf(
        ForbiddenError,
      );

      expect(repo.findMembersByProject).not.toHaveBeenCalled();
    });
  });

  describe('addMember - MIR-9', () => {
    it('permite invitar cuando el actor tiene permisos', async () => {
      const nuevoMiembro = miembroDePrueba({
        userId: 'user_2',
        role: 'MEMBER',
      });

      repo.findMember
        .mockResolvedValueOnce(miembroDePrueba({ role: 'OWNER' }))
        .mockResolvedValueOnce(null);

      repo.findUserByEmail.mockResolvedValue({
        id: 'user_2',
        email: 'nuevo@mira.dev',
      } as User);

      repo.addMemberWithActivity.mockResolvedValue(nuevoMiembro);

      const result = await service.addMember('project_1', 'owner_1', 'nuevo@mira.dev');

      expect(result).toEqual(nuevoMiembro);
      expect(repo.addMemberWithActivity).toHaveBeenCalledWith('project_1', 'user_2', 'owner_1');
    });

    it('rechaza a un MEMBER sin permisos de invitacion', async () => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role: 'MEMBER' }));

      await expect(
        service.addMember('project_1', 'member_1', 'nuevo@mira.dev'),
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(repo.findUserByEmail).not.toHaveBeenCalled();
      expect(repo.addMemberWithActivity).not.toHaveBeenCalled();
    });

    it('rechaza cuando el usuario no existe', async () => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role: 'OWNER' }));
      repo.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.addMember('project_1', 'owner_1', 'noexiste@mira.dev'),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.addMemberWithActivity).not.toHaveBeenCalled();
    });

    it('rechaza cuando el usuario ya pertenece al proyecto', async () => {
      repo.findMember
        .mockResolvedValueOnce(miembroDePrueba({ role: 'OWNER' }))
        .mockResolvedValueOnce(miembroDePrueba({ userId: 'user_2', role: 'MEMBER' }));

      repo.findUserByEmail.mockResolvedValue({
        id: 'user_2',
        email: 'existente@mira.dev',
      } as User);

      await expect(
        service.addMember('project_1', 'owner_1', 'existente@mira.dev'),
      ).rejects.toBeInstanceOf(ConflictError);

      expect(repo.addMemberWithActivity).not.toHaveBeenCalled();
    });
  });

  describe('getProjectSummary - MIR-23', () => {
    const resumenVacio = {
      total: 0,
      byStatus: { BACKLOG: 0, TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 },
      byType: { EPIC: 0, STORY: 0, TASK: 0, BUG: 0 },
      byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    };

    it('rechaza con 403 a quien no pertenece al proyecto, sin consultar el resumen', async () => {
      repo.findMember.mockResolvedValue(null);

      await expect(service.getProjectSummary('project_1', 'intruso')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.getProjectSummary).not.toHaveBeenCalled();
    });

    it('permite el resumen a un VIEWER', async () => {
      repo.findMember.mockResolvedValue(miembroDePrueba({ role: 'VIEWER', userId: 'viewer_1' }));
      repo.getProjectSummary.mockResolvedValue({ ...resumenVacio, recentActivity: [] });

      const result = await service.getProjectSummary('project_1', 'viewer_1');

      expect(result).toEqual({ ...resumenVacio, recentActivity: [] });
      expect(repo.getProjectSummary).toHaveBeenCalledWith('project_1');
    });

    it('serializa la fecha de cada actividad como ISO', async () => {
      repo.findMember.mockResolvedValue(miembroDePrueba());
      repo.getProjectSummary.mockResolvedValue({
        ...resumenVacio,
        recentActivity: [
          {
            id: 'act_1',
            action: 'MEMBER_ADDED',
            projectId: 'project_1',
            workItemId: null,
            actorId: 'owner_1',
            actor: { id: 'owner_1', name: 'Ada' },
            field: 'member',
            fromValue: null,
            toValue: 'Grace',
            createdAt: new Date('2026-10-01T12:00:00.000Z'),
          },
        ],
      });

      const result = await service.getProjectSummary('project_1', 'owner_1');

      expect(result.recentActivity).toEqual([
        {
          id: 'act_1',
          action: 'MEMBER_ADDED',
          workItemId: null,
          actor: { id: 'owner_1', name: 'Ada' },
          field: 'member',
          fromValue: null,
          toValue: 'Grace',
          createdAt: '2026-10-01T12:00:00.000Z',
        },
      ]);
    });
  });
});
