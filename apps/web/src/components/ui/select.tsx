import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lista desplegable con el mismo aspecto que Input.
 *
 * forwardRef es obligatorio: react-hook-form registra el campo por ref.
 *
 * MIR-24: igual que Input, bajo `sm` usa 16 px de fuente (con menos, iOS hace
 * zoom al enfocar) y 44 px de alto para el pulgar.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:h-10 sm:text-sm',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400',
          className,
        )}
        {...props}
      />
    );
  },
);
