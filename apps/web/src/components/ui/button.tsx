import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Boton base.
 *
 * Escrito a mano con la misma API que shadcn/ui para que el proyecto arranque
 * sin depender del CLI. Cuando corran `npx shadcn@latest add button` este
 * archivo se reemplaza por la version oficial y nada mas tiene que cambiar.
 *
 * MIR-24: bajo `sm` mide 44 px de alto, el minimo recomendado para un objetivo
 * tactil; desde `sm` vuelve a los 40 px de escritorio.
 */
type Variant = 'default' | 'secondary' | 'ghost' | 'destructive';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  ghost: 'hover:bg-slate-100 text-slate-900',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ className, variant = 'default', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium sm:h-10',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
