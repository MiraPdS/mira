import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { Project } from '@prisma/client';
import { ConflictError } from '../../lib/errors.js';
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
});
