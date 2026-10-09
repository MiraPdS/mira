import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  useAddMember,
  useChangeMemberRole,
  useDeleteProject,
  useRemoveMember,
  useUpdateProject,
  projectKeys,
} from './useProjects';
import { projectApi } from './project.api';

vi.mock('./project.api', () => ({
  projectApi: {
    addMember: vi.fn(),
    changeMemberRole: vi.fn(),
    remove: vi.fn(),
    removeMember: vi.fn(),
    update: vi.fn(),
  },
}));

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('Invalidacion de cache del resumen - MIR-23', () => {
  it('invalida el resumen al agregar un miembro', async () => {
    const projectId = 'project_1';
    const otherProjectId = 'project_2';
    const queryClient = createTestClient();

    queryClient.setQueryData(projectKeys.members(projectId), { members: [] });
    queryClient.setQueryData(projectKeys.summary(projectId), { total: 0 });
    queryClient.setQueryData(projectKeys.summary(otherProjectId), { total: 5 });

    vi.mocked(projectApi.addMember).mockResolvedValue({
      member: {
        id: 'member_1',
        userId: 'user_2',
        projectId,
        role: 'MEMBER',
        joinedAt: '2026-10-08T12:00:00.000Z',
      },
    });

    const { result } = renderHook(() => useAddMember(projectId), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ email: 'usuario@ejemplo.com', role: 'MEMBER' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryState(projectKeys.members(projectId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary(projectId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary(otherProjectId))?.isInvalidated).toBe(
      false,
    );
  });

  it('invalida el resumen al cambiar el rol de un miembro', async () => {
    const projectId = 'project_1';
    const otherProjectId = 'project_2';
    const queryClient = createTestClient();

    queryClient.setQueryData(projectKeys.members(projectId), { members: [] });
    queryClient.setQueryData(projectKeys.summary(projectId), { total: 0 });
    queryClient.setQueryData(projectKeys.summary(otherProjectId), { total: 5 });

    vi.mocked(projectApi.changeMemberRole).mockResolvedValue({
      member: {
        id: 'member_1',
        userId: 'user_2',
        projectId,
        role: 'VIEWER',
        joinedAt: '2026-10-08T12:00:00.000Z',
      },
    });

    const { result } = renderHook(() => useChangeMemberRole(projectId), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      userId: 'user_2',
      role: 'VIEWER',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryState(projectKeys.members(projectId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary(projectId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary(otherProjectId))?.isInvalidated).toBe(
      false,
    );
  });

  it('invalida miembros, backlog, detalles, tablero y resumen al quitar un miembro', async () => {
    const projectId = 'project_1';
    const otherProjectId = 'project_2';
    const queryClient = createTestClient();

    const membersKey = projectKeys.members(projectId);
    const summaryKey = projectKeys.summary(projectId);
    const otherSummaryKey = projectKeys.summary(otherProjectId);

    const backlogKey = ['work-items', 'backlog', projectId, 1, 10];
    const detailKey = ['work-item', projectId, 'work_item_1'];
    const boardKey = ['board', projectId];

    const otherBacklogKey = ['work-items', 'backlog', otherProjectId, 1, 10];
    const otherDetailKey = ['work-item', otherProjectId, 'work_item_2'];

    queryClient.setQueryData(membersKey, { members: [] });
    queryClient.setQueryData(summaryKey, { total: 2 });
    queryClient.setQueryData(otherSummaryKey, { total: 5 });

    queryClient.setQueryData(backlogKey, { items: [] });
    queryClient.setQueryData(detailKey, { id: 'work_item_1' });
    queryClient.setQueryData(boardKey, []);

    queryClient.setQueryData(otherBacklogKey, { items: [] });
    queryClient.setQueryData(otherDetailKey, { id: 'work_item_2' });

    vi.mocked(projectApi.removeMember).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRemoveMember(projectId), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate('user_2');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(projectApi.removeMember).toHaveBeenCalledWith(projectId, 'user_2');

    expect(queryClient.getQueryState(membersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(backlogKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(boardKey)?.isInvalidated).toBe(true);

    // Otros proyectos no deben verse afectados.
    expect(queryClient.getQueryState(otherSummaryKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherBacklogKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherDetailKey)?.isInvalidated).toBe(false);
  });
});

describe('useUpdateProject - MIR-7 + MIR-23', () => {
  it('invalida el resumen: la edicion deja una actividad PROJECT_UPDATED', async () => {
    const projectId = 'project_1';
    const queryClient = createTestClient();

    queryClient.setQueryData(projectKeys.summary(projectId), { total: 0 });
    queryClient.setQueryData(projectKeys.summary('project_2'), { total: 5 });

    vi.mocked(projectApi.update).mockResolvedValue({
      id: projectId,
      name: 'Mira 2',
      key: 'MIR',
      description: null,
      createdAt: '2026-10-08T12:00:00.000Z',
      updatedAt: '2026-10-08T12:00:00.000Z',
      myRole: 'OWNER',
    });

    const { result } = renderHook(() => useUpdateProject(projectId), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ name: 'Mira 2' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryState(projectKeys.summary(projectId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary('project_2'))?.isInvalidated).toBe(false);
  });
});

describe('useDeleteProject - MIR-8', () => {
  it('quita el proyecto de la lista y no vuelve a pedir su detalle', async () => {
    const queryClient = createTestClient();
    const proyecto = (id: string) => ({
      id,
      name: id,
      key: id.toUpperCase(),
      description: null,
      createdAt: '2026-10-08T12:00:00.000Z',
      updatedAt: '2026-10-08T12:00:00.000Z',
      myRole: 'OWNER' as const,
    });

    queryClient.setQueryData(projectKeys.all, [proyecto('project_1'), proyecto('project_2')]);
    queryClient.setQueryData(projectKeys.detail('project_1'), proyecto('project_1'));
    queryClient.setQueryData(projectKeys.summary('project_1'), { total: 3 });
    queryClient.setQueryData(projectKeys.summary('project_2'), { total: 5 });

    vi.mocked(projectApi.remove).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteProject('project_1'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(projectApi.remove).toHaveBeenCalledWith('project_1');
    expect(
      queryClient.getQueryData<Array<{ id: string }>>(projectKeys.all)?.map((p) => p.id),
    ).toEqual(['project_2']);

    // Lo que cuelga del proyecto eliminado queda obsoleto; lo de otros proyectos no.
    expect(queryClient.getQueryState(projectKeys.detail('project_1'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary('project_1'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(projectKeys.summary('project_2'))?.isInvalidated).toBe(false);
  });
});
