import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isTest } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { createProjectsRouter } from './modules/projects/projects.router.js';
import { createWorkItemRouter } from './modules/work-items/work-item.router.js';

/**
 * Construye la aplicacion Express SIN escuchar en un puerto.
 *
 * Esa separacion (app.ts arma, server.ts escucha) es lo que permite que
 * Supertest importe la app y le haga peticiones reales sin abrir sockets ni
 * pelear por puertos libres en CI.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      // Imprescindible para que el navegador envie y acepte la cookie de sesion.
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan('dev'));

  /** Sonda de salud: la usan Render, Jenkins y los E2E para esperar el arranque. */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/projects', createProjectsRouter());
  app.use('/api/projects', createWorkItemRouter());

  // Estos dos van SIEMPRE al final y en este orden.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
