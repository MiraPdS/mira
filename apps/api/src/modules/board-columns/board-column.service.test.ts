import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { ColumnCategory, ProjectRole } from '@mira/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { BoardColumnRecord, BoardColumnRepository } from './board-column.repository.js';
import { createBoardColumnService } from './board-column.service.js';

/**
 * NIVEL 1: reglas de MIR-48 con el repositorio en memoria. La concurrencia y
 * el movimiento real de elementos se prueban en la integracion.
 */

const PROJECT_ID = 'project_1';
const ACTOR_ID = 'user_1';

function columna(id: string, position: number, category: ColumnCategory): BoardColumnRecord {
  return { id, name: `Columna ${id}`, position, category, legacyStatus: null };
}

const POR_HACER = columna('col_todo', 0, 'TODO');
const EN_CURSO = columna('col_doing', 1, 'IN_PROGRESS');
const HECHO = columna('col_done', 2, 'DONE');

let repo: MockProxy<BoardColumnRepository>;
let service: ReturnType<typeof createBoardColumnService>;

function conRol(role: ProjectRole | null, columns = [POR_HACER, EN_CURSO, HECHO]) {
  repo.findMemberRole.mockResolvedValue(role);
  repo.listColumns.mockResolvedValue(columns);
}

beforeEach(() => {
  repo = mock<BoardColumnRepository>();
  // La transaccion del doble es el mismo repositorio.
  repo.withTransaction.mockImplementation((operation) => operation(repo));
  repo.countItemsInColumn.mockResolvedValue(0);
  service = createBoardColumnService(repo);
});

describe('permisos', () => {
  it.each<ProjectRole | null>(['MEMBER', 'VIEWER', null])(
    '%s no puede crear, editar, reordenar ni eliminar',
    async (role) => {
      conRol(role);

      await expect(
        service.create(PROJECT_ID, ACTOR_ID, { name: 'QA', category: 'TODO' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        service.update(PROJECT_ID, ACTOR_ID, POR_HACER.id, { name: 'Pendiente' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        service.reorder(PROJECT_ID, ACTOR_ID, { columnIds: [HECHO.id, EN_CURSO.id, POR_HACER.id] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(service.delete(PROJECT_ID, ACTOR_ID, EN_CURSO.id, {})).rejects.toBeInstanceOf(
        ForbiddenError,
      );

      expect(repo.createColumn).not.toHaveBeenCalled();
      expect(repo.updateColumn).not.toHaveBeenCalled();
      expect(repo.reorderColumns).not.toHaveBeenCalled();
      expect(repo.deleteColumn).not.toHaveBeenCalled();
    },
  );

  it('MEMBER y VIEWER si pueden listar las columnas', async () => {
    conRol('VIEWER');
    await expect(service.list(PROJECT_ID, ACTOR_ID)).resolves.toHaveLength(3);
  });
});

describe('create', () => {
  it('deja la columna nueva al final', async () => {
    conRol('OWNER');
    repo.createColumn.mockImplementation(async (data) => ({
      id: 'col_qa',
      legacyStatus: null,
      ...data,
    }));

    const column = await service.create(PROJECT_ID, ACTOR_ID, {
      name: 'QA',
      category: 'IN_PROGRESS',
    });

    expect(repo.createColumn).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      name: 'QA',
      category: 'IN_PROGRESS',
      position: 3,
    });
    expect(column).toEqual({ id: 'col_qa', name: 'QA', position: 3, category: 'IN_PROGRESS' });
  });

  it('en un proyecto sin columnas queda en la posicion 0', async () => {
    conRol('OWNER', []);
    repo.createColumn.mockImplementation(async (data) => ({
      id: 'col_1',
      legacyStatus: null,
      ...data,
    }));

    await service.create(PROJECT_ID, ACTOR_ID, { name: 'Hecho', category: 'DONE' });

    expect(repo.createColumn).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
  });
});

describe('update', () => {
  it('la ultima columna DONE no puede cambiar de categoria (409)', async () => {
    conRol('OWNER');

    const error = await service
      .update(PROJECT_ID, ACTOR_ID, HECHO.id, { category: 'IN_PROGRESS' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: 'LAST_DONE_COLUMN' });
    expect(repo.updateColumn).not.toHaveBeenCalled();
  });

  it('una DONE puede cambiar de categoria si queda otra DONE', async () => {
    const archivado = columna('col_archived', 3, 'DONE');
    conRol('OWNER', [POR_HACER, EN_CURSO, HECHO, archivado]);
    repo.updateColumn.mockResolvedValue({ ...HECHO, category: 'IN_PROGRESS' });

    await service.update(PROJECT_ID, ACTOR_ID, HECHO.id, { category: 'IN_PROGRESS' });

    expect(repo.updateColumn).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      columnId: HECHO.id,
      category: 'IN_PROGRESS',
    });
  });

  it('renombrar la ultima DONE no es problema', async () => {
    conRol('OWNER');
    repo.updateColumn.mockResolvedValue({ ...HECHO, name: 'Listo' });

    await expect(
      service.update(PROJECT_ID, ACTOR_ID, HECHO.id, { name: 'Listo', category: 'DONE' }),
    ).resolves.toMatchObject({ name: 'Listo' });
  });

  it('una columna de otro proyecto es 404', async () => {
    conRol('OWNER');

    await expect(
      service.update(PROJECT_ID, ACTOR_ID, 'col_ajena', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('reorder', () => {
  it('guarda el orden recibido', async () => {
    conRol('OWNER');
    const nuevoOrden = [HECHO.id, POR_HACER.id, EN_CURSO.id];

    await service.reorder(PROJECT_ID, ACTOR_ID, { columnIds: nuevoOrden });

    expect(repo.reorderColumns).toHaveBeenCalledWith(PROJECT_ID, nuevoOrden);
  });

  it.each([
    ['falta una columna', [HECHO.id, POR_HACER.id]],
    ['sobra una columna', [HECHO.id, POR_HACER.id, EN_CURSO.id, 'col_ajena']],
    ['trae una columna ajena', [HECHO.id, POR_HACER.id, 'col_ajena']],
  ])('409 si %s', async (_caso, columnIds) => {
    conRol('OWNER');

    await expect(service.reorder(PROJECT_ID, ACTOR_ID, { columnIds })).rejects.toMatchObject({
      code: 'COLUMN_ORDER_MISMATCH',
    });
    expect(repo.reorderColumns).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('una columna vacia se elimina sin destino', async () => {
    conRol('OWNER');

    await service.delete(PROJECT_ID, ACTOR_ID, EN_CURSO.id, {});

    expect(repo.deleteColumn).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      actorId: ACTOR_ID,
      column: EN_CURSO,
      moveTo: null,
    });
  });

  it('una columna con elementos y sin destino es 409', async () => {
    conRol('OWNER');
    repo.countItemsInColumn.mockResolvedValue(2);

    const error = await service
      .delete(PROJECT_ID, ACTOR_ID, EN_CURSO.id, {})
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: 'COLUMN_NOT_EMPTY' });
    expect(repo.deleteColumn).not.toHaveBeenCalled();
  });

  it('con destino, los elementos se mueven ahi', async () => {
    conRol('OWNER');
    repo.countItemsInColumn.mockResolvedValue(2);

    await service.delete(PROJECT_ID, ACTOR_ID, EN_CURSO.id, { moveTo: POR_HACER.id });

    expect(repo.deleteColumn).toHaveBeenCalledWith(
      expect.objectContaining({ column: EN_CURSO, moveTo: POR_HACER }),
    );
  });

  it('la ultima columna DONE no se puede eliminar (409)', async () => {
    conRol('OWNER');

    await expect(
      service.delete(PROJECT_ID, ACTOR_ID, HECHO.id, { moveTo: POR_HACER.id }),
    ).rejects.toMatchObject({ code: 'LAST_DONE_COLUMN' });
    expect(repo.deleteColumn).not.toHaveBeenCalled();
  });

  it.each([
    ['la misma columna', EN_CURSO.id, 'MOVE_TO_SAME_COLUMN'],
    ['una columna de otro proyecto', 'col_ajena', 'COLUMN_NOT_IN_PROJECT'],
  ])('el destino no puede ser %s (400)', async (_caso, moveTo, code) => {
    conRol('OWNER');

    const error = await service
      .delete(PROJECT_ID, ACTOR_ID, EN_CURSO.id, { moveTo })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({ code });
  });

  it('una columna inexistente es 404', async () => {
    conRol('OWNER');

    await expect(service.delete(PROJECT_ID, ACTOR_ID, 'col_x', {})).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
