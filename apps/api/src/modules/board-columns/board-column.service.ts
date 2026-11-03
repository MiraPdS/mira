import {
  can,
  type BoardColumnDto,
  type CreateBoardColumnInput,
  type DeleteBoardColumnQuery,
  type ReorderBoardColumnsInput,
  type UpdateBoardColumnInput,
} from '@mira/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { toBoardColumnDto } from '../work-items/work-item.service.js';
import type { BoardColumnRecord, BoardColumnRepository } from './board-column.repository.js';

/**
 * Sin una columna DONE nada se puede terminar: el panel (MIR-23) y el cierre
 * de sprint (MIR-46) dejarian de contar elementos terminados.
 */
function lastDoneColumnError(): ConflictError {
  return new ConflictError(
    'El proyecto debe conservar al menos una columna de categoria DONE',
    'LAST_DONE_COLUMN',
  );
}

function isLastDoneColumn(columns: BoardColumnRecord[], column: BoardColumnRecord): boolean {
  return (
    column.category === 'DONE' &&
    !columns.some((other) => other.id !== column.id && other.category === 'DONE')
  );
}

function findColumn(columns: BoardColumnRecord[], columnId: string): BoardColumnRecord {
  const column = columns.find((candidate) => candidate.id === columnId);
  if (!column) throw new NotFoundError('Columna', 'COLUMN_NOT_FOUND');
  return column;
}

/**
 * MIR-48: reglas para administrar las columnas del tablero.
 *
 * Toda modificacion es del OWNER (`column:manage`) y corre en una transaccion
 * serializable: las reglas se deciden leyendo todas las columnas del proyecto
 * y esa lectura no puede quedar obsoleta antes de escribir.
 */
export function createBoardColumnService(repo: BoardColumnRepository) {
  return {
    async list(projectId: string, actorId: string): Promise<BoardColumnDto[]> {
      const role = await repo.findMemberRole(projectId, actorId);
      if (!can(role, 'work-item:view')) throw new ForbiddenError();

      const columns = await repo.listColumns(projectId);
      return columns.map(toBoardColumnDto);
    },

    /** Crea la columna al final del tablero. */
    async create(
      projectId: string,
      actorId: string,
      input: CreateBoardColumnInput,
    ): Promise<BoardColumnDto> {
      return repo.withTransaction(async (transactionRepo) => {
        const role = await transactionRepo.findMemberRole(projectId, actorId);
        if (!can(role, 'column:manage')) throw new ForbiddenError();

        const columns = await transactionRepo.listColumns(projectId);
        const last = columns.at(-1);
        const column = await transactionRepo.createColumn({
          projectId,
          name: input.name,
          category: input.category,
          position: last ? last.position + 1 : 0,
        });
        return toBoardColumnDto(column);
      });
    },

    /** Renombra o cambia la categoria; la ultima DONE no puede dejar de serlo. */
    async update(
      projectId: string,
      actorId: string,
      columnId: string,
      input: UpdateBoardColumnInput,
    ): Promise<BoardColumnDto> {
      return repo.withTransaction(async (transactionRepo) => {
        const role = await transactionRepo.findMemberRole(projectId, actorId);
        if (!can(role, 'column:manage')) throw new ForbiddenError();

        const columns = await transactionRepo.listColumns(projectId);
        const column = findColumn(columns, columnId);

        if (
          input.category !== undefined &&
          input.category !== 'DONE' &&
          isLastDoneColumn(columns, column)
        ) {
          throw lastDoneColumnError();
        }

        const updated = await transactionRepo.updateColumn({ projectId, columnId, ...input });
        return toBoardColumnDto(updated);
      });
    },

    /**
     * Recibe el orden completo. Si no coincide con las columnas actuales (otra
     * persona agrego o borro una entretanto) es 409: el cliente debe recargar.
     */
    async reorder(
      projectId: string,
      actorId: string,
      input: ReorderBoardColumnsInput,
    ): Promise<BoardColumnDto[]> {
      return repo.withTransaction(async (transactionRepo) => {
        const role = await transactionRepo.findMemberRole(projectId, actorId);
        if (!can(role, 'column:manage')) throw new ForbiddenError();

        const columns = await transactionRepo.listColumns(projectId);
        const current = new Set(columns.map((column) => column.id));
        const sameColumns =
          input.columnIds.length === current.size && input.columnIds.every((id) => current.has(id));
        if (!sameColumns) {
          throw new ConflictError(
            'El orden debe incluir exactamente las columnas actuales del proyecto',
            'COLUMN_ORDER_MISMATCH',
          );
        }

        await transactionRepo.reorderColumns(projectId, input.columnIds);
        const reordered = await transactionRepo.listColumns(projectId);
        return reordered.map(toBoardColumnDto);
      });
    },

    /**
     * Elimina la columna. Con elementos exige `moveTo` (409 si falta); el
     * destino debe ser otra columna del mismo proyecto (400 si no).
     */
    async delete(
      projectId: string,
      actorId: string,
      columnId: string,
      query: DeleteBoardColumnQuery,
    ): Promise<void> {
      await repo.withTransaction(async (transactionRepo) => {
        const role = await transactionRepo.findMemberRole(projectId, actorId);
        if (!can(role, 'column:manage')) throw new ForbiddenError();

        const columns = await transactionRepo.listColumns(projectId);
        const column = findColumn(columns, columnId);
        if (isLastDoneColumn(columns, column)) throw lastDoneColumnError();

        let moveTo: BoardColumnRecord | null = null;
        if (query.moveTo !== undefined) {
          if (query.moveTo === columnId) {
            throw new BadRequestError(
              'La columna de destino debe ser otra columna',
              'MOVE_TO_SAME_COLUMN',
            );
          }
          moveTo = columns.find((candidate) => candidate.id === query.moveTo) ?? null;
          if (!moveTo) {
            throw new BadRequestError(
              'La columna de destino no pertenece al proyecto',
              'COLUMN_NOT_IN_PROJECT',
            );
          }
        }

        if (moveTo === null) {
          const itemCount = await transactionRepo.countItemsInColumn(projectId, columnId);
          if (itemCount > 0) {
            throw new ConflictError(
              'La columna tiene elementos; indica a que columna moverlos',
              'COLUMN_NOT_EMPTY',
            );
          }
        }

        await transactionRepo.deleteColumn({ projectId, actorId, column, moveTo });
      });
    },
  };
}

export type BoardColumnService = ReturnType<typeof createBoardColumnService>;
