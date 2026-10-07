import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../../lib/errors.js';
import type { ProjectService } from './project.service.js';

export function createProjectController(service: ProjectService) {
  return {
    async addMember(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const projectId = req.params.projectId;

        if (!projectId) {
          throw new BadRequestError('Falta el identificador del proyecto', 'PROJECT_ID_REQUIRED');
        }

        const member = await service.addMember(projectId, req.user.id, req.body.email);

        res.status(201).json({ member });
      } catch (error) {
        next(error);
      }
    },
  };
}
