import {
  KeyboardCode,
  pointerWithin,
  rectIntersection,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { BOARD_STATUSES, STATUS_LABELS, type WorkItemDto } from '@mira/shared';

/**
 * Configuracion de dnd-kit para el tablero (MIR-20).
 *
 * Cada columna es un droppable cuyo id es su estado, y cada tarjeta un
 * draggable que lleva el item en `data`: asi `onDragEnd` sabe que mover y a
 * donde sin buscar nada en la cache.
 */

export interface CardDragData {
  item: WorkItemDto;
}

type BoardStatus = (typeof BOARD_STATUSES)[number];

function isBoardStatus(value: unknown): value is BoardStatus {
  return (BOARD_STATUSES as readonly unknown[]).includes(value);
}

/** Estado de la columna bajo la tarjeta, o null si se solto fuera del tablero. */
export function columnaDestino(overId: unknown): BoardStatus | null {
  return isBoardStatus(overId) ? overId : null;
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
 */
export const saltarDeColumna: KeyboardCoordinateGetter = (
  event,
  { context: { active, collisionRect, droppableRects, over } },
) => {
  const paso = event.code === KeyboardCode.Right ? 1 : event.code === KeyboardCode.Left ? -1 : 0;
  if (paso === 0 || !collisionRect) return undefined;

  event.preventDefault();
  const data = active?.data.current as CardDragData | undefined;
  const actual = columnaDestino(over?.id) ?? columnaDestino(data?.item.status);
  if (!actual) return undefined;

  const destino = BOARD_STATUSES[BOARD_STATUSES.indexOf(actual) + paso];
  const rect = destino ? droppableRects.get(destino) : undefined;
  if (!rect) return undefined;

  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: collisionRect.top,
  };
};

function referencia(data: unknown): string {
  return (data as CardDragData | undefined)?.item.reference ?? 'la tarjeta';
}

function columna(id: unknown): string {
  const status = columnaDestino(id);
  return status ? STATUS_LABELS[status] : 'ninguna columna';
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
    `${referencia(active.data.current)} esta sobre ${columna(over?.id)}.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `Soltaste ${referencia(active.data.current)} en ${columna(over.id)}.`
      : `Soltaste ${referencia(active.data.current)} fuera del tablero; no se movio.`,
  onDragCancel: ({ active }) =>
    `Cancelaste el movimiento; ${referencia(active.data.current)} vuelve a su columna.`,
};
