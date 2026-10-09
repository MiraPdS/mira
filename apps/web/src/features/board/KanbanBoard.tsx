import {
  BOARD_STATUSES,
  can,
  STATUS_LABELS,
  type WorkItemDto,
  type WorkItemStatus,
} from '@mira/shared';
import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCurrentUser } from '@/features/auth/useAuth';
import { useProjectMembers } from '@/features/projects/useProjects';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  anuncios,
  columnaDestino,
  detectarColumna,
  instrucciones,
  saltarDeColumna,
  SensorTactilDesdeAsa,
  type BoardStatus,
  type CardDragData,
} from './boardDnd';
import { useBoard, useMoveWorkItem } from './useBoard';
import { TarjetaArrastrada, WorkItemCard } from './WorkItemCard';

export interface KanbanBoardProps {
  projectId: string;
}

interface BoardColumnProps {
  status: BoardStatus;
  items: WorkItemDto[];
  /** Ausente cuando el usuario no puede mover tarjetas. */
  onMove?: (item: WorkItemDto, status: WorkItemStatus) => void;
}

/**
 * Columna del tablero.
 *
 * La lista se renderiza SIEMPRE, aunque este vacia, y con alto minimo: es el
 * destino al que MIR-19 (menu "Mover a...") y MIR-20 (arrastre) llevan las
 * tarjetas, asi que no puede desaparecer cuando se queda sin items.
 *
 * MIR-24: en pantallas angostas la columna deja siempre 2.5rem libres para que
 * asome la siguiente y se note que el tablero se desplaza; desde 20.5rem
 * (328 px) de ancho util en adelante mide sus 18rem (w-72) de siempre.
 */
function BoardColumn({ status, items, onMove }: BoardColumnProps) {
  const label = STATUS_LABELS[status];
  const headingId = `columna-${status}`;
  // Toda la columna (titulo incluido) recibe tarjetas, no solo la lista.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'flex w-[min(18rem,calc(100%-2.5rem))] shrink-0 snap-start flex-col rounded-lg bg-slate-100 p-3 transition-colors',
        isOver && 'bg-sky-100 ring-2 ring-sky-300',
      )}
    >
      <h3 id={headingId} className="flex items-center justify-between text-sm font-semibold">
        <span className="text-slate-800">{label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
          <span className="sr-only">Cantidad: </span>
          {items.length}
        </span>
      </h3>

      <div className="relative mt-3 flex flex-1">
        <ul
          aria-label={`Tarjetas de ${label}`}
          data-status={status}
          className={cn(
            'flex min-h-24 min-w-0 flex-1 flex-col gap-2 rounded-md',
            items.length === 0 && 'border-2 border-dashed border-slate-300',
          )}
        >
          {items.map((item) => (
            <WorkItemCard
              key={item.id}
              item={item}
              onMove={onMove ? (destino) => onMove(item, destino) : undefined}
            />
          ))}
        </ul>
        {items.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Sin elementos
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Auto-scroll al acercar la tarjeta al borde del tablero (MIR-24).
 *
 * Los valores por defecto de dnd-kit (20 % del ancho como zona de borde y
 * aceleracion 10) estan pensados para escritorio: en 375 px toda la franja
 * visible de la columna siguiente caia en la zona y el tablero corria a mas
 * de 1500 px/s, sin dar tiempo a soltar ahi. Con una zona mas angosta y menos
 * aceleracion, soltar en la columna que asoma es facil y para llegar a una
 * lejana basta con mantener el dedo junto al borde.
 */
const AUTO_SCROLL = { threshold: { x: 0.1, y: 0.2 }, acceleration: 3 };

/**
 * Tablero Kanban reutilizable: su contenedor entrega el proyecto, por lo que
 * este componente no necesita conocer rutas.
 *
 * Las columnas salen de BOARD_STATUSES (el orden del arreglo es el orden en
 * pantalla), no de los items recibidos: asi una columna vacia existe igual.
 */
export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const board = useBoard(projectId);
  const move = useMoveWorkItem(projectId);

  // Mismo criterio que la API (can() compartido): mientras el rol no se
  // conozca, o si falla su consulta, el menu no se ofrece.
  const { data: currentUser, isError: userError } = useCurrentUser();
  const { data: members, isError: membersError } = useProjectMembers(projectId);
  const role = members?.members.find((member) => member.user.id === currentUser?.id)?.role;
  const canMove = !userError && !membersError && can(role, 'work-item:change-status');

  // La distancia minima evita que un clic (en "Mover a..." o en la tarjeta)
  // se interprete como un arrastre. Raton y tacto van por separado (MIR-24):
  // con el dedo solo arrastra el asa, para que deslizar sobre una tarjeta
  // desplace las columnas.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(SensorTactilDesdeAsa, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: saltarDeColumna }),
  );

  // Id de la tarjeta en vuelo: la dibuja el DragOverlay y, mientras exista, el
  // tablero no encaja columnas (ver la region mas abajo). Se guarda el id y no
  // el item: asi el overlay muestra lo ultimo de la cache si un refresco cambia
  // la tarjeta durante el arrastre.
  const [enVueloId, setEnVueloId] = useState<string | null>(null);
  const tomar = ({ active }: DragStartEvent) => setEnVueloId(String(active.id));

  // MIR-24: antes de reactivar el encaje, el tablero se alinea con la columna
  // donde queda la tarjeta. Si se reactivara tal cual, tras el auto-scroll el
  // navegador podia encajar en la columna vecina y dejar la tarjeta fuera de
  // vista. Se fija en el mismo evento, con el encaje aun suspendido.
  const regionRef = useRef<HTMLDivElement>(null);
  const alinearCon = (status: BoardStatus) => {
    const region = regionRef.current;
    const columna = region?.querySelector<HTMLElement>(`[aria-labelledby="columna-${status}"]`);
    if (region && columna) region.scrollLeft = columna.offsetLeft;
  };

  // Misma mutacion optimista que el menu (MIR-19): si la API falla, la
  // tarjeta vuelve a su columna y aparece el mismo mensaje de error.
  const soltar = ({ active, over }: DragEndEvent) => {
    const item = (active.data.current as CardDragData | undefined)?.item;
    const destino = columnaDestino(over?.id);
    const seMueve = canMove && item && destino && destino !== item.status;
    const columnaFinal = seMueve ? destino : columnaDestino(item?.status);
    if (columnaFinal) alinearCon(columnaFinal);
    setEnVueloId(null);
    if (seMueve) move.mutate({ item, status: destino });
  };

  const cancelar = ({ active }: DragCancelEvent) => {
    const origen = columnaDestino((active.data.current as CardDragData | undefined)?.item.status);
    if (origen) alinearCon(origen);
    setEnVueloId(null);
  };

  if (board.isPending) {
    return (
      <p role="status" className="p-6 text-sm text-slate-500">
        Cargando tablero...
      </p>
    );
  }

  if (board.isError) {
    const message =
      board.error instanceof ApiRequestError
        ? board.error.message
        : 'No se pudo cargar el tablero. Intentalo nuevamente.';

    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {message}
      </p>
    );
  }

  const items = board.data;
  const enVuelo = enVueloId ? items.find((item) => item.id === enVueloId) : undefined;

  return (
    <section aria-labelledby="tablero-titulo" className="min-w-0">
      <h2 id="tablero-titulo" className="text-xl font-semibold text-slate-900">
        Tablero
      </h2>
      {/* Hasta xl las cuatro columnas no caben y el tablero se desplaza. */}
      <p className="mt-1 text-sm text-slate-500 xl:hidden">
        Desliza horizontalmente para ver todas las columnas.
      </p>

      {move.isError ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo mover {move.variables.item.reference}: {move.error.message}
        </p>
      ) : null}

      {/* Region enfocable: en 375 px las columnas se desplazan dentro de ella
          (tambien con teclado) sin ensanchar la pagina. `relative` es
          necesario: sin el, los textos sr-only (absolutos) de las columnas
          fuera de vista se posicionan contra el documento y lo ensanchan. */}
      <DndContext
        sensors={sensors}
        collisionDetection={detectarColumna}
        onDragStart={tomar}
        onDragEnd={soltar}
        onDragCancel={cancelar}
        autoScroll={AUTO_SCROLL}
        accessibility={{ announcements: anuncios, screenReaderInstructions: instrucciones }}
      >
        {/* MIR-24: el encaje (snap) se suspende durante el arrastre. Con el
            encaje activo, cada paso del auto-scroll saltaba una columna
            entera y la tarjeta pasaba de "Por hacer" a "Hecho" de golpe. */}
        <div
          ref={regionRef}
          role="region"
          aria-label="Columnas del tablero"
          tabIndex={0}
          className={cn(
            'relative mt-4 flex gap-4 overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-slate-400',
            !enVueloId && 'snap-x snap-mandatory',
          )}
        >
          {BOARD_STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              items={items.filter((item) => item.status === status)}
              onMove={
                canMove ? (item, destino) => move.mutate({ item, status: destino }) : undefined
              }
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {enVuelo ? <TarjetaArrastrada item={enVuelo} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
