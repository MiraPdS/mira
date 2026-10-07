import type { ReactNode } from 'react';

/**
 * Etiqueta + campo + texto de ayuda + mensaje de error.
 *
 * El <label htmlFor> es lo que permite que los tests usen
 * getByLabelText('Correo electronico') en vez de un selector CSS fragil.
 * Escribir esto bien es accesibilidad Y testabilidad al mismo tiempo.
 *
 * El hint y el error se pintan con ids predecibles (`<id>-hint`,
 * `<id>-error`) para que el control los referencie con aria-describedby.
 * El error admite ReactNode para poder incluir un enlace (p. ej. "inicia
 * sesion" cuando el correo ya existe).
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
