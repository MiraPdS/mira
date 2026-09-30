import { z } from 'zod';

/**
 * Contrato de autenticacion.
 *
 * El MISMO esquema se usa en tres lugares:
 *  - Express lo corre en runtime sobre req.body (middleware validate).
 *  - El formulario de React lo corre via zodResolver de react-hook-form.
 *  - TypeScript infiere de aqui los tipos de ambos lados.
 * Consecuencia buscada: cambiar una regla aqui rompe la compilacion en los dos
 * lados de inmediato, en vez de producir un bug silencioso en produccion.
 */

/** Minimo 8 caracteres con al menos una letra y un numero. */
export const passwordSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(72, 'La contrasena no puede superar los 72 caracteres') // limite real de bcrypt
  .regex(/[a-zA-Z]/, 'La contrasena debe incluir al menos una letra')
  .regex(/[0-9]/, 'La contrasena debe incluir al menos un numero');

/**
 * El orden de la cadena importa: Zod aplica los checks en el orden en que se
 * declaran. `trim()` y `toLowerCase()` van PRIMERO para que `email()` valide
 * el valor ya normalizado; al reves, "  ADA@Mira.DEV  " seria rechazado por
 * los espacios antes de llegar a recortarse.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'El correo es obligatorio')
  .email('Correo electronico invalido')
  .max(255);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // En login NO se aplican las reglas de fortaleza: si el usuario tiene una
  // contrasena antigua debe poder entrar, y detallar el formato aqui filtra
  // informacion sobre las politicas de la cuenta.
  password: z.string().min(1, 'La contrasena es obligatoria'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Usuario tal como viaja al cliente. Nunca incluye passwordHash. */
export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/**
 * Respuesta de login y registro.
 *
 * Nota deliberada: NO contiene el token.  El JWT viaja en una cookie httpOnly
 * que el navegador gestiona solo; si el token apareciera aqui, JavaScript
 * podria leerlo y perderiamos la proteccion contra XSS que motivo la decision.
 */
export const authResponseSchema = z.object({ user: publicUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;
