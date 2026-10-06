import { useMutation } from '@tanstack/react-query';
import type { CreateWorkItemInput, WorkItemDto } from '@mira/shared';
import { createWorkItem } from './work-items.api';

/** Mutacion de creacion desacoplada de rutas, listas y navegacion. */
export function useCreateWorkItem(projectId: string) {
  return useMutation<WorkItemDto, Error, CreateWorkItemInput>({
    mutationFn: (input) => createWorkItem(projectId, input),
  });
}
