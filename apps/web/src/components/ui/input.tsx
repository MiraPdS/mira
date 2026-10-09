import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto.
 *
 * forwardRef es obligatorio: react-hook-form registra el campo por ref.
 * `aria-invalid` permite que los tests consulten el estado de error sin
 * depender de clases CSS.
 *
 * MIR-24: bajo `sm` usa 16 px de fuente (con menos, iOS hace zoom al enfocar
 * el campo y la pagina queda desplazada) y 44 px de alto para el pulgar.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:h-10 sm:text-sm',
          'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400',
          className,
        )}
        {...props}
      />
    );
  },
);
