import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useSprints } from '@/features/sprints/useSprints';
import { useAssignWorkItemSprint } from './useWorkItems';

export function WorkItemSprintField({
  projectId,
  workItemId,
  sprintId,
  canEdit,
}: {
  projectId: string;
  workItemId: string;
  sprintId: string | null;
  canEdit: boolean;
}) {
  const sprints = useSprints(projectId);
  const assignment = useAssignWorkItemSprint(projectId, workItemId);
  const id = useId();
  const current = sprints.data?.find((sprint) => sprint.id === sprintId);
  const label = sprintId === null ? 'Sin sprint' : (current?.name ?? 'Sprint no disponible');
  const selected = assignment.isPending ? (assignment.variables ?? '') : (sprintId ?? '');

  return (
    <>
      {canEdit ? (
        <>
          <label htmlFor={id} className="sr-only">
            Sprint
          </label>
          <Select
            id={id}
            value={selected}
            disabled={sprints.isPending || sprints.isError || assignment.isPending}
            aria-busy={sprints.isPending || assignment.isPending}
            onChange={(event) => {
              assignment.reset();
              assignment.mutate(event.target.value || null);
            }}
          >
            <option value="">{sprints.isPending ? 'Cargando sprints...' : 'Sin sprint'}</option>
            {sprintId && (!current || current.status === 'CLOSED') ? (
              <option value={sprintId} disabled>
                {label}
                {current?.status === 'CLOSED' ? ' (cerrado)' : ''}
              </option>
            ) : null}
            {sprints.data
              ?.filter((sprint) => sprint.status === 'PLANNED' || sprint.status === 'ACTIVE')
              .map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
          </Select>
        </>
      ) : (
        <span>{sprints.isPending && sprintId ? 'Cargando sprint...' : label}</span>
      )}
      {sprints.isError ? (
        <div role="alert" className="mt-1 text-sm text-red-700">
          No se pudo cargar la lista de sprints.
          <Button variant="secondary" onClick={() => void sprints.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {assignment.error ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {assignment.error.message}
        </p>
      ) : null}
    </>
  );
}
