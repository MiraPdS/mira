import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`[mira-api] escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/** Apagado ordenado: Render y Docker envian SIGTERM al redeployar. */
async function shutdown(signal: string) {
  console.info(`[mira-api] ${signal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
