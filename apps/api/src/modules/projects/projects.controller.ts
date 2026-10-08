import type { NextFunction, Request, Response } from 'express';
import type { CreateProjectInput, ListProjectsResponse, ProjectDto } from '@mira/shared';
import { UnauthorizedError } from '../../lib/errors.js';
import type { ProjectsService } from './projects.service.js';

/** Capa HTTP del modulo projects. Sin reglas de negocio: eso va en el service. */
export function createProjectsController(service: ProjectsService) {
  return {
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const project = await service.create(req.body as CreateProjectInput, req.user.id);
        res.status(201).json({ project } satisfies { project: ProjectDto });
      } catch (error) {
        next(error);
      }
    },

    async list(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();
        const projects = await service.listForUser(req.user.id);
        res.json({ projects } satisfies ListProjectsResponse);
      } catch (error) {
        next(error);
      }
    },
  };
}
