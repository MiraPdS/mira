import type { NextFunction, Request, Response } from 'express';
import type { CreateProjectInput, ListProjectsResponse, ProjectDto } from '@mira/shared';
import { BadRequestError, UnauthorizedError } from '../../lib/errors.js';
import type { ProjectsService } from './projects.service.js';

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

    async listMembers(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const projectId = req.params.projectId;

        if (!projectId) {
          throw new BadRequestError('Falta el identificador del proyecto', 'PROJECT_ID_REQUIRED');
        }

        const members = await service.getMembers(projectId, req.user.id);

        res.status(200).json({ members });
      } catch (error) {
        next(error);
      }
    },

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

    // MIR-23: Obtener el resumen estadistico y actividad reciente.
    async getSummary(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const projectId = req.params.projectId;

        if (!projectId) {
          throw new BadRequestError('Falta el identificador del proyecto', 'PROJECT_ID_REQUIRED');
        }

        const summary = await service.getProjectSummary(projectId, req.user.id);

        res.status(200).json({ summary });
      } catch (error) {
        next(error);
      }
    },
  };
}
