import { useEffect, useId, useRef, useState } from 'react';
import type { SprintListItemDto } from '@mira/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCloseSprint, useStartSprint } from './useSprints';

/** MIR-46: el padre comprueba sprint:update; VIEWER nunca monta estas acciones. */
export function SprintLifecycleControls({
  sprint,
  sprints,
}: {
  sprint: SprintListItemDto;
  sprints: SprintListItemDto[];
}) {
  const [open, setOpen] = useState(false);
  const starting = sprint.status === 'PLANNED';
  const label = starting ? 'Iniciar sprint' : 'Cerrar sprint';
  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      {open ? (
        <LifecycleDialog
          sprint={sprint}
          sprints={sprints}
          starting={starting}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function LifecycleDialog({
  sprint,
  sprints,
  starting,
  onCancel,
}: {
  sprint: SprintListItemDto;
  sprints: SprintListItemDto[];
  starting: boolean;
  onCancel: () => void;
}) {
  const start = useStartSprint(sprint.projectId, sprint.id);
  const close = useCloseSprint(sprint.projectId, sprint.id);
  const mutation = starting ? start : close;
  const [destination, setDestination] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const destinationId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const cancel = () => {
    if (!mutation.isPending) onCancel();
  };
  const confirm = () => {
    if (starting) start.mutate(undefined, { onSuccess: onCancel });
    else close.mutate({ moveUnfinishedToSprintId: destination || null }, { onSuccess: onCancel });
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      className="w-full max-w-lg space-y-4 rounded-lg p-6 backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {starting ? 'Iniciar sprint' : 'Cerrar sprint'}: {sprint.name}
      </h2>
      <p>
        {starting
          ? 'El sprint pasara a activo. Solo puede haber uno activo por proyecto.'
          : 'Solo los elementos no terminados se moveran al destino elegido. Los terminados permanecen en el sprint cerrado.'}
      </p>
      {!starting ? (
        <div>
          <label htmlFor={destinationId}>Destino de los elementos no terminados</label>
          <Select
            id={destinationId}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            disabled={mutation.isPending}
          >
            <option value="">Backlog</option>
            {sprints
              .filter(
                (candidate) =>
                  candidate.status === 'PLANNED' && candidate.projectId === sprint.projectId,
              )
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </Select>
        </div>
      ) : null}
      {mutation.error ? (
        <p role="alert" className="text-red-700">
          {mutation.error.message}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button variant="secondary" autoFocus onClick={cancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={confirm} disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Confirmar'}
        </Button>
      </div>
    </dialog>
  );
}
