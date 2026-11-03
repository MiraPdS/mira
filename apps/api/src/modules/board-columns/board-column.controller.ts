import type { NextFunction, Request, Response } from 'express';
import type {
  BoardColumnListResponse,
  BoardColumnResponse,
  CreateBoardColumnInput,
  DeleteBoardColumnQuery,
  ReorderBoardColumnsInput,
  UpdateBoardColumnInput,
} from '@mira/shared';
import { UnauthorizedError } from '../../lib/errors.js';
import { validatedQuery } from '../../middleware/validate.js';
import type { BoardColumnService } from './board-column.service.js';

/**
 * Capa HTTP de las columnas (MIR-48). Sin reglas ni permisos: ambos viven en
 * el service.
 */
export function createBoardColumnController(service: BoardColumnService) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const columns = await service.list(req.params.projectId!, req.user.id);
        res.status(200).json({ columns } satisfies BoardColumnListResponse);
      } catch (error) {
        next(error);
      }
    },

    async create(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const column = await service.create(
          req.params.projectId!,
          req.user.id,
          req.body as CreateBoardColumnInput,
        );
        res.status(201).json({ column } satisfies BoardColumnResponse);
      } catch (error) {
        next(error);
      }
    },

    async update(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const column = await service.update(
          req.params.projectId!,
          req.user.id,
          req.params.columnId!,
          req.body as UpdateBoardColumnInput,
        );
        res.status(200).json({ column } satisfies BoardColumnResponse);
      } catch (error) {
        next(error);
      }
    },

    async reorder(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const columns = await service.reorder(
          req.params.projectId!,
          req.user.id,
          req.body as ReorderBoardColumnsInput,
        );
        res.status(200).json({ columns } satisfies BoardColumnListResponse);
      } catch (error) {
        next(error);
      }
    },

    async delete(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        await service.delete(
          req.params.projectId!,
          req.user.id,
          req.params.columnId!,
          validatedQuery<DeleteBoardColumnQuery>(res),
        );
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
