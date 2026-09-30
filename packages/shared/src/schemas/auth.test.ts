import { describe, expect, it } from 'vitest';
import { loginSchema, passwordSchema, registerSchema } from './auth.js';

/**
 * Los esquemas Zod son el contrato compartido: se testean una sola vez aqui y
 * esa garantia vale para el backend (validacion en runtime) y para el
 * formulario de React (zodResolver), porque ambos corren ESTE codigo.
 */

describe('passwordSchema', () => {
  it.each([
    ['abcd1234', true, 'minimo valido: 8 chars, letra y numero'],
    ['Segura2026', true, 'con mayusculas'],
    ['abc123', false, 'menos de 8 caracteres'],
    ['abcdefgh', false, 'sin numeros'],
    ['12345678', false, 'sin letras'],
    ['', false, 'vacia'],
  ])('%s -> %s (%s)', (value, esperado) => {
    expect(passwordSchema.safeParse(value).success).toBe(esperado);
  });

  it('rechaza mas de 72 caracteres porque bcrypt trunca en ese punto', () => {
    const larga = 'a1'.repeat(40); // 80 caracteres
    expect(passwordSchema.safeParse(larga).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valido = { name: 'Ada Lovelace', email: 'ada@mira.dev', password: 'abcd1234' };

  it('acepta una entrada valida', () => {
    expect(registerSchema.safeParse(valido).success).toBe(true);
  });

  it('normaliza el correo a minusculas y sin espacios', () => {
    const result = registerSchema.parse({ ...valido, email: '  ADA@Mira.DEV  ' });
    expect(result.email).toBe('ada@mira.dev');
  });

  it('recorta los espacios del nombre', () => {
    expect(registerSchema.parse({ ...valido, name: '  Ada  ' }).name).toBe('Ada');
  });

  it.each([
    ['name', { ...valido, name: 'A' }],
    ['email', { ...valido, email: 'no-es-un-correo' }],
    ['password', { ...valido, password: 'corta' }],
  ])('rechaza cuando %s es invalido', (_campo, entrada) => {
    expect(registerSchema.safeParse(entrada).success).toBe(false);
  });

  it('reporta el campo exacto que fallo, para pintarlo en el formulario', () => {
    const result = registerSchema.safeParse({ ...valido, email: 'roto' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['email']);
    }
  });
});

describe('loginSchema', () => {
  it('no exige fortaleza de contrasena, solo que no este vacia', () => {
    // Deliberado: una cuenta antigua con contrasena debil debe poder entrar,
    // y detallar la politica en login filtra informacion.
    expect(loginSchema.safeParse({ email: 'ada@mira.dev', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'ada@mira.dev', password: '' }).success).toBe(false);
  });
});
