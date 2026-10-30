import { Prisma } from '@prisma/client';
import type { ColumnCategory, ProjectRole } from '@mira/shared';
import { findMemberRole, hasTransaction, prisma, type Db } from '../../lib/prisma.js';
import {
  activityValueOfColumn,
  type BoardColumnRecord,
} from '../work-items/work-item.repository.js';

export type { BoardColumnRecord } from '../work-items/work-item.repository.js';

export interface CreateBoardColumnData {
  projectId: string;
  name: string;
  category: ColumnCategory;
  position: number;
}

export interface UpdateBoardColumnData {
  projectId: string;
  columnId: string;
  name?: string;
  category?: ColumnCategory;
}

/**
 * Eliminar una columna. Si `moveTo` no es null, sus elementos pasan ahi y cada
 * uno deja su ITEM_STATUS_CHANGED, igual que si se hubiera movido a mano.
 */
export interface DeleteBoardColumnData {
  projectId: string;
  actorId: string;
  column: BoardColumnRecord;
  moveTo: BoardColumnRecord | null;
}

/**
 * Puerto de persistencia de las columnas (MIR-48).
 *
 * Las reglas (siempre una columna DONE, destino obligatorio) las decide el
 * service leyendo dentro de `withTransaction`; por eso cada escritura asume
 * que ya corre en esa transaccion y no abre otra.
 */
export interface BoardColumnRepository {
  withTransaction<T>(operation: (repo: BoardColumnRepository) => Promise<T>): Promise<T>;
  findMemberRole(projectId: string, userId: string): Promise<ProjectRole | null>;
  /** Columnas del proyecto, en el orden del tablero. */
  listColumns(projectId: string): Promise<BoardColumnRecord[]>;
  countItemsInColumn(projectId: string, columnId: string): Promise<number>;
  createColumn(data: CreateBoardColumnData): Promise<BoardColumnRecord>;
  updateColumn(data: UpdateBoardColumnData): Promise<BoardColumnRecord>;
  /** Escribe position = indice en `columnIds`, que ya trae todas las columnas. */
  reorderColumns(projectId: string, columnIds: string[]): Promise<void>;
  deleteColumn(data: DeleteBoardColumnData): Promise<void>;
}

const columnSelect = {
  id: true,
  name: true,
  position: true,
  category: true,
  legacyStatus: true,
} as const;

export function createBoardColumnRepository(db: Db = prisma): BoardColumnRepository {
  const repo: BoardColumnRepository = {
    async withTransaction(operation) {
      if (!hasTransaction(db)) return operation(repo);
      // Serializable: dos OWNER que borran a la vez las dos ultimas columnas
      // DONE leerian "queda otra" cada uno; asi una de las dos se reintenta y
      // ve la verdad.
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await db.$transaction((tx) => operation(createBoardColumnRepository(tx)), {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
        } catch (error) {
          if (
            attempt >= 2 ||
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2034'
          )
            throw error;
        }
      }
    },

    findMemberRole: (projectId, userId) => findMemberRole(db, projectId, userId),

    async listColumns(projectId) {
      return db.boardColumn.findMany({
        where: { projectId },
        // Mismo orden que el tablero (work-item.repository).
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: columnSelect,
      });
    },

    async countItemsInColumn(projectId, columnId) {
      return db.workItem.count({ where: { projectId, columnId } });
    },

    async createColumn(data) {
      return db.boardColumn.create({ data, select: columnSelect });
    },

    async updateColumn({ projectId, columnId, ...data }) {
      return db.boardColumn.update({
        where: { id_projectId: { id: columnId, projectId } },
        data,
        select: columnSelect,
      });
    },

    async reorderColumns(projectId, columnIds) {
      // Sin unique en (projectId, position), asi que no hay posiciones
      // intermedias que choquen mientras se reescriben una a una.
      await Promise.all(
        columnIds.map((id, position) =>
          db.boardColumn.update({
            where: { id_projectId: { id, projectId } },
            data: { position },
          }),
        ),
      );
    },

    async deleteColumn({ projectId, actorId, column, moveTo }) {
      if (moveTo) {
        const items = await db.workItem.findMany({
          where: { projectId, columnId: column.id },
          select: { id: true },
        });
        if (items.length > 0) {
          await db.workItem.updateMany({
            where: { projectId, columnId: column.id },
            data: { columnId: moveTo.id },
          });
          await db.activityLog.createMany({
            data: items.map((item) => ({
              action: 'ITEM_STATUS_CHANGED' as const,
              projectId,
              workItemId: item.id,
              actorId,
              field: 'status',
              fromValue: activityValueOfColumn(column),
              toValue: activityValueOfColumn(moveTo),
            })),
          });
        }
      }

      await db.boardColumn.delete({ where: { id_projectId: { id: column.id, projectId } } });

      // Cierra el hueco: las posiciones siguen siendo 0..n-1.
      await db.boardColumn.updateMany({
        where: { projectId, position: { gt: column.position } },
        data: { position: { decrement: 1 } },
      });
    },
  };
  return repo;
}
