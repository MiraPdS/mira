import { config } from 'dotenv';
import { z } from 'zod';
import { resolve } from 'node:path';

/**
 * Configuracion validada al arrancar.
 *
 * Se valida con Zod y se hace `process.exit(1)` si falta algo: es preferible
 * que la API se niegue a arrancar a que corra con JWT_SECRET undefined y
 * firme tokens invalidos durante horas sin que nadie lo note.
 *
 * El .env vive en la RAIZ del monorepo, no en apps/api: una sola fuente de
 * configuracion para todos los workspaces.
 */
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') }); // por si se ejecuta desde apps/api

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  TEST_DATABASE_URL: z.string().optional(),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres (generar con: openssl rand -base64 48)'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Con cookies httpOnly el origen debe ser exacto: "*" es invalido cuando
  // se envian credenciales, el navegador rechaza la respuesta.
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(
      `\nNo se pudo iniciar la API: faltan o son invalidas variables de entorno.\n${detalle}\n\nRevisa el archivo .env (puedes partir de .env.example).\n`,
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
