import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CATEGORY_LABELS,
  COLUMN_CATEGORIES,
  createBoardColumnSchema,
  type BoardColumnDto,
  type CreateBoardColumnInput,
} from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useBoard, useBoardColumns } from './useBoard';
import {
  useCreateBoardColumn,
  useDeleteBoardColumn,
  useReorderBoardColumns,
  useUpdateBoardColumn,
} from './useBoardColumnAdmin';

export interface BoardColumnsSettingsProps {
  projectId: string;
  /** `can(rol, 'column:manage')`: solo el OWNER modifica las columnas. */
  canManage: boolean;
}

/** `null`: nada abierto; `'nueva'`: agregando; otro valor: id de la columna en edicion. */
type Edicion = null | 'nueva' | string;

/** Mensaje para un error de la API de columnas, sin exponer codigos internos. */
function mensajeDeError(error: ApiRequestError): string {
  if (error.status === 403) return 'Solo el propietario puede modificar las columnas.';
  if (error.code === 'COLUMN_ORDER_MISMATCH') {
    return 'Las columnas cambiaron mientras tanto. Se recargo la lista; intentalo de nuevo.';
  }
  return error.message;
}

/**
 * MIR-50: columnas del tablero en la configuracion del proyecto. Todos los
 * miembros las ven en su orden; solo el OWNER puede agregar, renombrar,
 * reordenar y eliminar (API de MIR-48).
 */
export function BoardColumnsSettings({ projectId, canManage }: BoardColumnsSettingsProps) {
  const columnas = useBoardColumns(projectId);
  const reordenar = useReorderBoardColumns(projectId);
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [eliminando, setEliminando] = useState<BoardColumnDto | null>(null);
  const tituloId = useId();

  const mover = (indice: number, delta: -1 | 1) => {
    if (!columnas.data) return;
    const ids = columnas.data.map((column) => column.id);
    const destino = indice + delta;
    [ids[indice], ids[destino]] = [ids[destino]!, ids[indice]!];
    reordenar.mutate(ids);
  };

  return (
    <section aria-labelledby={tituloId} className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={tituloId} className="text-lg font-semibold text-slate-900">
            Columnas del tablero
          </h2>
          <p className="text-sm text-slate-600">
            {canManage
              ? 'Define las etapas del tablero y su orden.'
              : 'Solo el propietario del proyecto puede modificarlas.'}
          </p>
        </div>
        {canManage && columnas.isSuccess && edicion !== 'nueva' ? (
          <Button onClick={() => setEdicion('nueva')}>+ Agregar columna</Button>
        ) : null}
      </div>

      {edicion === 'nueva' && canManage ? (
        <ColumnForm projectId={projectId} onDone={() => setEdicion(null)} />
      ) : null}

      {reordenar.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {mensajeDeError(reordenar.error)}
        </p>
      ) : null}

      {columnas.isPending ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando columnas...
        </p>
      ) : columnas.isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-red-700">No se pudieron cargar las columnas.</p>
          <Button variant="secondary" onClick={() => void columnas.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <ol aria-label="Columnas en el orden del tablero" className="space-y-2">
          {columnas.data.map((column, indice) => (
            <li key={column.id}>
              {edicion === column.id && canManage ? (
                <ColumnForm projectId={projectId} column={column} onDone={() => setEdicion(null)} />
              ) : (
                <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium wrap-anywhere text-slate-900">{column.name}</h3>
                    <p className="text-sm text-slate-500">{CATEGORY_LABELS[column.category]}</p>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        aria-label={`Subir ${column.name}`}
                        disabled={indice === 0 || reordenar.isPending}
                        onClick={() => mover(indice, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Bajar ${column.name}`}
                        disabled={indice === columnas.data.length - 1 || reordenar.isPending}
                        onClick={() => mover(indice, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="secondary"
                        aria-label={`Editar columna ${column.name}`}
                        onClick={() => setEdicion(column.id)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        aria-label={`Eliminar columna ${column.name}`}
                        onClick={() => setEliminando(column)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {eliminando && canManage && columnas.data ? (
        <DeleteColumnDialog
          projectId={projectId}
          column={eliminando}
          columns={columnas.data}
          onClose={() => setEliminando(null)}
        />
      ) : null}
    </section>
  );
}

/** Agregar (sin `column`) o editar una columna: nombre y categoria. */
function ColumnForm({
  projectId,
  column,
  onDone,
}: {
  projectId: string;
  column?: BoardColumnDto;
  onDone: () => void;
}) {
  const prefijo = useId();
  const ids = { name: `${prefijo}-name`, category: `${prefijo}-category` };
  const crear = useCreateBoardColumn(projectId);
  const editar = useUpdateBoardColumn(projectId);
  const mutation = column ? editar : crear;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBoardColumnInput>({
    resolver: zodResolver(createBoardColumnSchema),
    defaultValues: { name: column?.name ?? '', category: column?.category ?? 'TODO' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (column) {
        // Solo lo que cambio; sin cambios no hay PATCH.
        const cambios = {
          ...(values.name !== column.name && { name: values.name }),
          ...(values.category !== column.category && { category: values.category }),
        };
        if (Object.keys(cambios).length === 0) {
          onDone();
          return;
        }
        await editar.mutateAsync({ columnId: column.id, input: cambios });
      } else {
        await crear.mutateAsync(values);
      }
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 422) {
        for (const campo of ['name', 'category'] as const) {
          const mensaje = error.fieldError(campo);
          if (mensaje) setError(campo, { type: 'server', message: mensaje });
        }
      }
    }
  });

  const errorApi = mutation.error;
  const errorServidor =
    errorApi && !errorApi.fieldError('name') && !errorApi.fieldError('category')
      ? mensajeDeError(errorApi)
      : undefined;
  const pendiente = isSubmitting || mutation.isPending;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={column ? `Editar columna ${column.name}` : 'Agregar columna'}
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={ids.name} label="Nombre" error={errors.name?.message}>
          <Input
            id={ids.name}
            type="text"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${ids.name}-error` : undefined}
            {...register('name')}
          />
        </Field>
        <Field id={ids.category} label="Categoria" error={errors.category?.message}>
          <Select
            id={ids.category}
            aria-invalid={Boolean(errors.category)}
            aria-describedby={errors.category ? `${ids.category}-error` : undefined}
            {...register('category')}
          >
            {COLUMN_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {errorServidor ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServidor}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={pendiente}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando...' : column ? 'Guardar' : 'Agregar'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Confirmacion de eliminar. Si la columna tiene elementos (se cuentan en el
 * tablero, o lo avisa la API con 409 COLUMN_NOT_EMPTY) pide la columna de
 * destino antes de eliminar.
 */
function DeleteColumnDialog({
  projectId,
  column,
  columns,
  onClose,
}: {
  projectId: string;
  column: BoardColumnDto;
  columns: BoardColumnDto[];
  onClose: () => void;
}) {
  const eliminar = useDeleteBoardColumn(projectId);
  const tablero = useBoard(projectId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descripcionId = useId();
  const destinoId = useId();
  const otras = columns.filter((candidate) => candidate.id !== column.id);
  const [destino, setDestino] = useState(otras[0]?.id ?? '');
  const [avisoServidor, setAvisoServidor] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const cantidad = tablero.data
    ? tablero.data.items.filter((item) => item.columnId === column.id).length
    : 0;
  const pideDestino = cantidad > 0 || avisoServidor;

  const cerrar = () => {
    if (!eliminar.isPending) onClose();
  };

  const confirmar = () => {
    eliminar.mutate(
      { columnId: column.id, moveTo: pideDestino ? destino : undefined },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (error.code === 'COLUMN_NOT_EMPTY') setAvisoServidor(true);
        },
      },
    );
  };

  // El 409 COLUMN_NOT_EMPTY ya se explica pidiendo el destino.
  const errorVisible =
    eliminar.error && eliminar.error.code !== 'COLUMN_NOT_EMPTY'
      ? mensajeDeError(eliminar.error)
      : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      aria-describedby={descripcionId}
      className="w-full max-w-lg rounded-lg p-6 backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        cerrar();
      }}
    >
      <h3 id={tituloId} className="text-lg font-semibold">
        Eliminar columna
      </h3>
      <p id={descripcionId} className="my-4 text-sm wrap-anywhere text-slate-700">
        {tablero.isPending && !avisoServidor
          ? `¿Eliminar la columna «${column.name}»?`
          : pideDestino
            ? cantidad > 0
              ? `La columna «${column.name}» tiene ${cantidad} ${cantidad === 1 ? 'elemento' : 'elementos'}. Elige a que columna moverlos antes de eliminarla.`
              : `La columna «${column.name}» tiene elementos. Elige a que columna moverlos antes de eliminarla.`
            : `¿Eliminar la columna «${column.name}»? No tiene elementos.`}
      </p>

      {tablero.isPending && !avisoServidor ? (
        <p role="status" className="mb-4 text-sm text-slate-500">
          Revisando sus elementos...
        </p>
      ) : null}

      {pideDestino ? (
        <div className="mb-4 space-y-1.5">
          <label htmlFor={destinoId} className="text-sm font-medium text-slate-700">
            Mover sus elementos a
          </label>
          <Select
            id={destinoId}
            value={destino}
            onChange={(event) => setDestino(event.target.value)}
          >
            {otras.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {errorVisible ? (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {errorVisible}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button variant="secondary" autoFocus disabled={eliminar.isPending} onClick={cerrar}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          disabled={eliminar.isPending || (tablero.isPending && !avisoServidor)}
          onClick={confirmar}
        >
          {eliminar.isPending ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </div>
    </dialog>
  );
}
