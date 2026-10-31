import type { NextFunction, Request, Response } from 'express';
import type {
  CloseSprintInput,
  CreateSprintInput,
  SprintDto,
  SprintListItemDto,
  UpdateSprintInput,
} from '@mira/shared';
import { UnauthorizedError } from '../../lib/errors.js';
import type { SprintService } from './sprint.service.js';

type SprintResponse = { sprint: SprintDto };
type SprintListResponse = { data: SprintListItemDto[] };

/** Adaptador HTTP: autenticacion en router; autorizacion y negocio en service. */
export function createSprintController(service: SprintService) {
  return {
    async start(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const sprint = await service.start(
          req.params.projectId!,
          req.user.id,
          req.params.sprintId!,
        );
        res.status(200).json({ sprint } satisfies SprintResponse);
      } catch (error) {
        next(error);
      }
    },
    async close(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const sprint = await service.close(
          req.params.projectId!,
          req.user.id,
          req.params.sprintId!,
          req.body as CloseSprintInput,
        );
        res.status(200).json({ sprint } satisfies SprintResponse);
      } catch (error) {
        next(error);
      }
    },
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const sprint = await service.create(
          req.params.projectId!,
          req.user.id,
          req.body as CreateSprintInput,
        );
        res.status(201).json({ sprint } satisfies SprintResponse);
      } catch (error) {
        next(error);
      }
    },
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const data = await service.list(req.params.projectId!, req.user.id);
        res.status(200).json({ data } satisfies SprintListResponse);
      } catch (error) {
        next(error);
      }
    },
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const sprint = await service.update(
          req.params.projectId!,
          req.user.id,
          req.params.sprintId!,
          req.body as UpdateSprintInput,
        );
        res.status(200).json({ sprint } satisfies SprintResponse);
      } catch (error) {
        next(error);
      }
    },
    async delete(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        await service.delete(req.params.projectId!, req.user.id, req.params.sprintId!);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
