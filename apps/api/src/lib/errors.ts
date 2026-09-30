/**
 * Errores de dominio.
 *
 * Los services lanzan estos errores SIN saber nada de HTTP; el manejador de
 * errores de Express los traduce a codigos de estado.  Asi los tests
 * unitarios del service asertan sobre el error de dominio, no sobre un numero
 * magico, y el service sigue siendo testeable sin levantar un servidor.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 - la peticion no tiene sentido en el estado actual. */
export class BadRequestError extends AppError {
  constructor(message = 'Peticion invalida', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/** 401 - no sabemos quien eres. */
export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/** 403 - sabemos quien eres y no te alcanza. */
export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta accion', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/** 404 - no existe, o no existe PARA TI (no revelamos cual de las dos). */
export class NotFoundError extends AppError {
  constructor(recurso = 'Recurso', code = 'NOT_FOUND') {
    super(`${recurso} no encontrado`, 404, code);
  }
}

/** 409 - choca con algo que ya existe. */
export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/** 422 - la forma del cuerpo no cumple el esquema Zod. */
export class ValidationError extends AppError {
  constructor(fields: Record<string, string[]>, message = 'Datos invalidos') {
    super(message, 422, 'VALIDATION_ERROR', fields);
  }
}
