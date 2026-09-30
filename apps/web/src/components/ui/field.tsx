import type { ReactNode } from 'react';

/**
 * Etiqueta + campo + mensaje de error.
 *
 * El <label htmlFor> es lo que permite que los tests usen
 * getByLabelText('Correo electronico') en vez de un selector CSS fragil.
 * Escribir esto bien es accesibilidad Y testabilidad al mismo tiempo.
 */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
