import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useRemoveMember, projectKeys } from './useProjects';
import { projectApi } from './project.api';

vi.mock('./project.api', () => ({
  projectApi: {
    removeMember: vi.fn(),
  },
}));

describe('useRemoveMember - MIR-10', () => {
  it('invalida miembros, backlog y detalles del proyecto al eliminar un miembro', async () => {
    const projectId = 'project_1';
    const otherProjectId = 'project_2';

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const membersKey = projectKeys.members(projectId);
    const backlogKey = ['work-items', 'backlog', projectId, 1, 10];
    const detailKey = ['work-item', projectId, 'work_item_1'];

    const otherBacklogKey = ['work-items', 'backlog', otherProjectId, 1, 10];
    const otherDetailKey = ['work-item', otherProjectId, 'work_item_2'];

    // Crear entradas de cache para comprobar su invalidacion.
    queryClient.setQueryData(membersKey, { members: [] });
    queryClient.setQueryData(backlogKey, { items: [] });
    queryClient.setQueryData(detailKey, { id: 'work_item_1' });

    queryClient.setQueryData(otherBacklogKey, { items: [] });
    queryClient.setQueryData(otherDetailKey, { id: 'work_item_2' });

    vi.mocked(projectApi.removeMember).mockResolvedValue(undefined);

    function wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useRemoveMember(projectId), {
      wrapper,
    });

    result.current.mutate('user_2');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(projectApi.removeMember).toHaveBeenCalledWith(projectId, 'user_2');

    // Las tres consultas del proyecto deben quedar invalidadas.
    expect(queryClient.getQueryState(membersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(backlogKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);

    // Las consultas de otros proyectos no deben invalidarse.
    expect(queryClient.getQueryState(otherBacklogKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherDetailKey)?.isInvalidated).toBe(false);
  });
});
