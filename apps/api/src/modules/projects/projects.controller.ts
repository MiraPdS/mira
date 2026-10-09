import type { NextFunction, Request, Response } from 'express';
import type {
  CreateProjectInput,
  ListProjectsResponse,
  ProjectResponse,
  ProjectRole,
  ProjectSummaryResponse,
  UpdateProjectInput,
} from '@mira/shared';
import { BadRequestError, UnauthorizedError } from '../../lib/errors.js';
import type { ProjectsService } from './projects.service.js';

export function createProjectsController(service: ProjectsService) {
  return {
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const project = await service.create(req.body as CreateProjectInput, req.user.id);

        res.status(201).json({ project } satisfies ProjectResponse);
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

    async get(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const projectId = req.params.projectId;

        if (!projectId) {
          throw new BadRequestError('Falta el identificador del proyecto', 'PROJECT_ID_REQUIRED');
        }

        const project = await service.getById(projectId, req.user.id);

        res.json({ project } satisfies ProjectResponse);
      } catch (error) {
        next(error);
      }
    },

    async update(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const projectId = req.params.projectId;

        if (!projectId) {
          throw new BadRequestError('Falta el identificador del proyecto', 'PROJECT_ID_REQUIRED');
        }

        const project = await service.update(
          projectId,
          req.user.id,
          req.body as UpdateProjectInput,
        );

        res.json({ project } satisfies ProjectResponse);
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

    // MIR-10: Cambiar el rol de un miembro
    async changeMemberRole(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const { projectId, userId } = req.params;

        if (!projectId || !userId) {
          throw new BadRequestError(
            'Falta el identificador del proyecto o del usuario',
            'MEMBER_PARAMS_REQUIRED',
          );
        }

        const member = await service.changeMemberRole(
          projectId,
          req.user.id,
          userId,
          req.body.role as ProjectRole,
        );

        res.status(200).json({ member });
      } catch (error) {
        next(error);
      }
    },

    // MIR-10: Quitar un miembro del proyecto
    async removeMember(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const { projectId, userId } = req.params;

        if (!projectId || !userId) {
          throw new BadRequestError(
            'Falta el identificador del proyecto o del usuario',
            'MEMBER_PARAMS_REQUIRED',
          );
        }

        await service.removeMember(projectId, req.user.id, userId);

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    // MIR-23: Resumen estadistico y actividad reciente del proyecto.
    async getSummary(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) throw new UnauthorizedError();

        const projectId = req.params.projectId;

        if (!projectId) {
          throw new BadRequestError('Falta el identificador del proyecto', 'PROJECT_ID_REQUIRED');
        }

        const summary = await service.getProjectSummary(projectId, req.user.id);

        res.json({ summary } satisfies ProjectSummaryResponse);
      } catch (error) {
        next(error);
      }
    },
  };
}
