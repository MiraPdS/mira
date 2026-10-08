import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { Project, ProjectMember, User } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { ProjectsRepository } from './projects.repository.js';
import { createProjectsService } from './projects.service.js';

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
});
