import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Configuracion del CLI de Prisma.
 *
 * Existe por una razon concreta: el `.env` vive en la RAIZ del monorepo (una
 * sola fuente de configuracion para los tres workspaces), pero el CLI de
 * Prisma solo busca `.env` junto al schema. Sin esto, `prisma migrate` falla
 * con "Environment variable not found: DIRECT_URL".
 *
 * Reemplaza ademas a la clave `prisma` de package.json, que queda obsoleta en
 * Prisma 7.
 */
loadEnv({ path: path.resolve(import.meta.dirname, '../../.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
