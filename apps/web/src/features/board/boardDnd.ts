import {
  KeyboardCode,
  pointerWithin,
  rectIntersection,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
  TouchSensor,
  type TouchSensorOptions,
} from '@dnd-kit/core';
import type { TouchEvent } from 'react';
import type { BoardColumnDto, WorkItemDto } from '@mira/shared';

/**
 * Configuracion de dnd-kit para el tablero (MIR-20).
 *
 * MIR-49: cada columna del proyecto es un droppable cuyo id es el de la
 * columna y que lleva la columna en `data`; cada tarjeta es un draggable que
 * lleva el item en `data`. Asi `onDragEnd` sabe que mover y a donde sin
 * buscar nada en la cache.
 */

export interface CardDragData {
  item: WorkItemDto;
}

export interface ColumnDropData {
  column: BoardColumnDto;
}

/** Lo minimo de un droppable de dnd-kit (`over`) que se necesita leer. */
interface ConDatos {
  data: { current?: unknown };
}

/** Columna bajo la tarjeta, o null si se solto fuera del tablero. */
export function columnaDestino(over: ConDatos | null | undefined): BoardColumnDto | null {
  return (over?.data.current as ColumnDropData | undefined)?.column ?? null;
}

/**
 * Con raton manda la columna bajo el puntero, que es lo que el usuario ve.
 * Con teclado no hay puntero, asi que se usa la interseccion de la tarjeta
 * con las columnas.
 */
export const detectarColumna: CollisionDetection = (args) => {
  const bajoElPuntero = pointerWithin(args);
  return bajoElPuntero.length > 0 ? bajoElPuntero : rectIntersection(args);
};

/**
 * Teclado: las flechas izquierda y derecha llevan la tarjeta al centro de la
 * columna vecina, en vez de desplazarla 25 px por pulsacion (lo que obligaria
 * a pulsar una docena de veces para cambiar de columna). Arriba y abajo no
 * hacen nada: el tablero no tiene orden dentro de una columna.
 *
 * MIR-49: las columnas son las del proyecto, asi que la vecina se busca en el
 * orden en pantalla (de izquierda a derecha), sin una lista fija de estados.
 */
export const saltarDeColumna: KeyboardCoordinateGetter = (
  event,
  { context: { active, collisionRect, droppableRects, over } },
) => {
  const paso = event.code === KeyboardCode.Right ? 1 : event.code === KeyboardCode.Left ? -1 : 0;
  if (paso === 0 || !collisionRect) return undefined;

  event.preventDefault();
  const data = active?.data.current as CardDragData | undefined;
  const actual = over?.id ?? data?.item.columnId;
  if (actual === undefined || actual === null) return undefined;

  const enPantalla = [...droppableRects.entries()].sort(([, a], [, b]) => a.left - b.left);
  const indice = enPantalla.findIndex(([id]) => id === actual);
  if (indice === -1) return undefined;
  const rect = enPantalla[indice + paso]?.[1];
  if (!rect) return undefined;

  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: collisionRect.top,
  };
};

function referencia(data: unknown): string {
  return (data as CardDragData | undefined)?.item.reference ?? 'la tarjeta';
}

function columna(over: ConDatos | null | undefined): string {
  return columnaDestino(over)?.name ?? 'ninguna columna';
}

/** Lo que oye un lector de pantalla al tomar una tarjeta con el teclado. */
export const instrucciones: ScreenReaderInstructions = {
  draggable:
    'Para mover la tarjeta, pulsa Espacio o Enter. Usa las flechas izquierda y derecha ' +
    'para cambiar de columna, Espacio o Enter para soltarla y Escape para cancelar.',
};

export const anuncios: Announcements = {
  onDragStart: ({ active }) => `Tomaste ${referencia(active.data.current)}.`,
  onDragOver: ({ active, over }) =>
    `${referencia(active.data.current)} esta sobre ${columna(over)}.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `Soltaste ${referencia(active.data.current)} en ${columna(over)}.`
      : `Soltaste ${referencia(active.data.current)} fuera del tablero; no se movio.`,
  onDragCancel: ({ active }) =>
    `Cancelaste el movimiento; ${referencia(active.data.current)} vuelve a su columna.`,
};

/** Selector del asa (`data-asa-arrastre` en WorkItemCard): el sensor tactil solo arranca desde ella. */
const SELECTOR_ASA = '[data-asa-arrastre]';

/**
 * Sensor tactil que solo se activa desde el asa de la tarjeta (MIR-24).
 *
 * Con un unico PointerSensor, un dedo que desliza sobre la tarjeta para
 * recorrer las columnas superaba los 5 px de activacion antes de que el
 * navegador tomara el gesto, y en vez de desplazar el tablero iniciaba un
 * arrastre. Asi, en pantallas tactiles el cuerpo de la tarjeta queda libre
 * para desplazar y el asa (`touch-none`) arrastra de inmediato.
 */
export class SensorTactilDesdeAsa extends TouchSensor {
  static override activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: (event: TouchEvent, options: TouchSensorOptions) => {
        const objetivo = event.nativeEvent.target;
        if (!(objetivo instanceof Element) || !objetivo.closest(SELECTOR_ASA)) return false;
        return TouchSensor.activators[0]!.handler(event, options);
      },
    },
  ];
}
