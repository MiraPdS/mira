import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { CreateCommentInput } from '@mira/shared';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CommentForDto, CommentRepository } from './comment.repository.js';
import { createCommentService, toCommentDto } from './comment.service.js';

const PROJECT_ID = 'project_1';
const WORK_ITEM_ID = 'item_1';
const ACTOR_ID = 'user_1';

const INPUT: CreateCommentInput = {
  body: 'Este es un comentario de prueba',
};

function comentarioDePrueba(overrides: Partial<CommentForDto> = {}): CommentForDto {
  return {
    id: 'comment_1',
    body: INPUT.body,
    author: {
      id: ACTOR_ID,
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    },
    createdAt: new Date('2026-10-08T12:00:00.000Z'),
    ...overrides,
  };
}

describe('commentService', () => {
  let repo: MockProxy<CommentRepository>;
  let service: ReturnType<typeof createCommentService>;

  beforeEach(() => {
    repo = mock<CommentRepository>();
    service = createCommentService(repo);
  });

  describe('create', () => {
    it.each(['OWNER', 'MEMBER'] as const)('%s puede crear comentarios', async (role) => {
      repo.findMemberRole.mockResolvedValue(role);
      repo.workItemExists.mockResolvedValue(true);
      repo.createAtomically.mockResolvedValue(comentarioDePrueba());

      const result = await service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, INPUT);

      expect(result).toMatchObject({
        id: 'comment_1',
        body: INPUT.body,
      });

      expect(repo.createAtomically).toHaveBeenCalledTimes(1);
    });

    it('rechaza VIEWER sin crear comentarios', async () => {
      repo.findMemberRole.mockResolvedValue('VIEWER');

      await expect(
        service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, INPUT),
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(repo.workItemExists).not.toHaveBeenCalled();
      expect(repo.createAtomically).not.toHaveBeenCalled();
    });

    it('oculta el elemento a usuarios sin membresia', async () => {
      repo.findMemberRole.mockResolvedValue(null);

      await expect(
        service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, INPUT),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.workItemExists).not.toHaveBeenCalled();
      expect(repo.createAtomically).not.toHaveBeenCalled();
    });

    it('rechaza elementos inexistentes', async () => {
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.workItemExists.mockResolvedValue(false);

      await expect(
        service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, INPUT),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.createAtomically).not.toHaveBeenCalled();
    });

    it('consulta la membresia y existencia del elemento con los IDs correctos', async () => {
      repo.findMemberRole.mockResolvedValue('OWNER');
      repo.workItemExists.mockResolvedValue(true);
      repo.createAtomically.mockResolvedValue(comentarioDePrueba());

      await service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, INPUT);

      expect(repo.findMemberRole).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);

      expect(repo.workItemExists).toHaveBeenCalledWith(PROJECT_ID, WORK_ITEM_ID);
    });

    it('elimina espacios al inicio y final antes de persistir', async () => {
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.workItemExists.mockResolvedValue(true);
      repo.createAtomically.mockResolvedValue(comentarioDePrueba());

      await service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, {
        body: '  Comentario con espacios  ',
      });

      expect(repo.createAtomically).toHaveBeenCalledExactlyOnceWith({
        projectId: PROJECT_ID,
        workItemId: WORK_ITEM_ID,
        actorId: ACTOR_ID,
        body: 'Comentario con espacios',
      });
    });

    it('propaga errores de persistencia', async () => {
      const error = new Error('Error de base de datos');

      repo.findMemberRole.mockResolvedValue('OWNER');
      repo.workItemExists.mockResolvedValue(true);
      repo.createAtomically.mockRejectedValue(error);

      await expect(service.create(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID, INPUT)).rejects.toBe(error);
    });
  });

  describe('list', () => {
    it.each(['OWNER', 'MEMBER', 'VIEWER'] as const)(
      '%s puede consultar comentarios',
      async (role) => {
        repo.findMemberRole.mockResolvedValue(role);
        repo.workItemExists.mockResolvedValue(true);
        repo.listByWorkItem.mockResolvedValue([comentarioDePrueba()]);

        const result = await service.list(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID);

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('comment_1');

        expect(repo.listByWorkItem).toHaveBeenCalledWith(WORK_ITEM_ID);
      },
    );

    it('rechaza usuarios sin membresia', async () => {
      repo.findMemberRole.mockResolvedValue(null);

      await expect(service.list(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );

      expect(repo.workItemExists).not.toHaveBeenCalled();
      expect(repo.listByWorkItem).not.toHaveBeenCalled();
    });

    it('rechaza elementos inexistentes', async () => {
      repo.findMemberRole.mockResolvedValue('VIEWER');
      repo.workItemExists.mockResolvedValue(false);

      await expect(service.list(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );

      expect(repo.listByWorkItem).not.toHaveBeenCalled();
    });

    it('mantiene el orden entregado por el repositorio', async () => {
      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.workItemExists.mockResolvedValue(true);

      repo.listByWorkItem.mockResolvedValue([
        comentarioDePrueba({
          id: 'comment_1',
          body: 'Primer comentario',
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
        }),
        comentarioDePrueba({
          id: 'comment_2',
          body: 'Segundo comentario',
          createdAt: new Date('2026-10-02T10:00:00.000Z'),
        }),
      ]);

      const result = await service.list(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID);

      expect(result.map((comment) => comment.body)).toEqual([
        'Primer comentario',
        'Segundo comentario',
      ]);
    });

    it('devuelve un arreglo vacio cuando no hay comentarios', async () => {
      repo.findMemberRole.mockResolvedValue('VIEWER');
      repo.workItemExists.mockResolvedValue(true);
      repo.listByWorkItem.mockResolvedValue([]);

      await expect(service.list(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID)).resolves.toEqual([]);
    });

    it('propaga errores del repositorio', async () => {
      const error = new Error('Error al listar comentarios');

      repo.findMemberRole.mockResolvedValue('MEMBER');
      repo.workItemExists.mockResolvedValue(true);
      repo.listByWorkItem.mockRejectedValue(error);

      await expect(service.list(PROJECT_ID, ACTOR_ID, WORK_ITEM_ID)).rejects.toBe(error);
    });
  });
});

describe('toCommentDto', () => {
  it('convierte las fechas a ISO y conserva los datos del autor', () => {
    const result = toCommentDto(comentarioDePrueba());

    expect(result).toEqual({
      id: 'comment_1',
      body: 'Este es un comentario de prueba',
      author: {
        id: 'user_1',
        name: 'Ada Lovelace',
        email: 'ada@mira.dev',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      createdAt: '2026-10-08T12:00:00.000Z',
    });
  });
});
