import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto de varias lineas con el mismo aspecto que Input.
 *
 * forwardRef es obligatorio: react-hook-form registra el campo por ref.
 *
 * MIR-24: bajo `sm` usa 16 px de fuente para que iOS no haga zoom al enfocar.
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm',
        'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-400',
        className,
      )}
      {...props}
    />
  );
});
