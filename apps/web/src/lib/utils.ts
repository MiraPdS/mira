import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Helper estandar de shadcn/ui: combina clases y resuelve conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
