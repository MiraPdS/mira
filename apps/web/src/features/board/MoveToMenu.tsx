import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { BoardColumnDto } from '@mira/shared';
import { cn } from '@/lib/utils';

export interface MoveToMenuProps {
  /** Referencia legible del item, para nombrar el menu ("Mover MIR-3 a"). */
  reference: string;
  /** MIR-49: columnas del proyecto, en el orden del tablero. */
  columns: readonly BoardColumnDto[];
  /** Columna actual de la tarjeta; no se ofrece como destino. */
  currentColumnId: string | null;
  onMove: (column: BoardColumnDto) => void;
}

/**
 * Menu "Mover a..." de una tarjeta (MIR-19).
 *
 * Es el camino determinista para cambiar de columna: no depende del arrastre
 * (MIR-20), funciona con teclado y es el que usan las pruebas E2E.
 *
 * Sigue el patron de menu de botones de WAI-ARIA: el boton abre el menu y
 * enfoca la primera opcion, las flechas recorren las opciones, Escape cierra
 * y devuelve el foco al boton. Ofrece todas las columnas del proyecto
 * (MIR-49), en su orden, menos la actual.
 */
export function MoveToMenu({ reference, columns, currentColumnId, onMove }: MoveToMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const destinos = columns.filter((column) => column.id !== currentColumnId);
  itemRefs.current.length = destinos.length;

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();

    // Un clic fuera del menu lo cierra, como cualquier menu desplegable.
    const cerrarAlClicFuera = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', cerrarAlClicFuera);
    return () => document.removeEventListener('pointerdown', cerrarAlClicFuera);
  }, [open]);

  const cerrar = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const elegir = (column: BoardColumnDto) => {
    cerrar();
    onMove(column);
  };

  const navegar = (event: KeyboardEvent<HTMLUListElement>) => {
    const opciones = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const actual = opciones.indexOf(document.activeElement as HTMLButtonElement);
    const enfocar = (index: number) =>
      opciones[(index + opciones.length) % opciones.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        enfocar(actual + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        enfocar(actual - 1);
        break;
      case 'Home':
        event.preventDefault();
        enfocar(0);
        break;
      case 'End':
        event.preventDefault();
        enfocar(opciones.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        cerrar();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((abierto) => !abierto)}
        className="-my-2 -mr-2 h-11 rounded px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-400 sm:my-0 sm:mr-0 sm:h-auto sm:px-2 sm:py-1 sm:text-xs"
      >
        Mover a…
      </button>

      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={`Mover ${reference} a`}
          onKeyDown={navegar}
          className="absolute right-0 z-10 mt-1 max-h-72 w-48 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {destinos.map((column, index) => (
            <li key={column.id} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => elegir(column)}
                className={cn(
                  'block min-h-11 w-full px-3 py-1.5 text-left text-sm wrap-anywhere text-slate-800 sm:min-h-0',
                  'hover:bg-slate-100 focus:bg-slate-100 focus:outline-none',
                )}
              >
                {column.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
