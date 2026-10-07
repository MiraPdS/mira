import type { NextFunction, Request, Response } from 'express';
import type {
  CreateWorkItemInput,
  PaginationQuery,
  UpdateWorkItemInput,
  WorkItemDto,
} from '@mira/shared';
import { UnauthorizedError } from '../../lib/errors.js';
import { validatedQuery } from '../../middleware/validate.js';
import type { WorkItemService } from './work-item.service.js';

type WorkItemResponse = { item: WorkItemDto };

/**
 * Capa HTTP: traduce peticion -> caso de uso -> respuesta.
 *
 * No contiene autorizacion por rol ni reglas de negocio; ambas pertenecen al
 * service. La autenticacion ya fue comprobada por requireAuth en el router.
 */
export function createWorkItemController(service: WorkItemService) {
  return {
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const item = await service.create(
          // El router declara :projectId para esta accion; Express lo tipa
          // opcional porque Request es generico para todas las rutas.
          req.params.projectId!,
          req.user.id,
          req.body as CreateWorkItemInput,
        );
        res.status(201).json({ item } satisfies WorkItemResponse);
      } catch (error) {
        next(error);
      }
    },

    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const item = await service.getById(
          req.params.projectId!,
          req.user.id,
          req.params.workItemId!,
        );
        res.status(200).json({ item } satisfies WorkItemResponse);
      } catch (error) {
        next(error);
      }
    },

    async update(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const { item } = await service.update(
          req.params.projectId!,
          req.user.id,
          req.params.workItemId!,
          req.body as UpdateWorkItemInput,
        );
        res.status(200).json({ item } satisfies WorkItemResponse);
      } catch (error) {
        next(error);
      }
    },

    async list(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const result = await service.list(
          req.params.projectId!,
          req.user.id,
          validatedQuery<PaginationQuery>(res),
        );
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}
