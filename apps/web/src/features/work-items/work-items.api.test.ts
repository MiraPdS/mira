import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { UpdateWorkItemInput, WorkItemDto } from '@mira/shared';
import { server } from '@/test/msw/server';
import { updateWorkItem, deleteWorkItem, listWorkItems } from './work-items.api';

import { apiError } from '@/test/msw/handlers';
import { ApiRequestError } from '@/lib/api-client';
const PROJECT_ID = 'project_123';
const WORK_ITEMS_URL = 'http://localhost:3000/api/projects/:projectId/work-items';
const BASE_URL = 'http://localhost:3000/api';

function itemDePrueba(overrides: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: 'item_456',
    reference: 'MIR-15',
    projectId: 'project_123',
    title: 'Titulo original',
    description: null,
    type: 'TASK',
    status: 'BACKLOG',
    priority: 'MEDIUM',
    estimate: null,
    dueDate: null,
    assignee: null,
    createdBy: {
      id: 'user_1',
      name: 'Ada Lovelace',
      email: 'ada@mira.dev',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    sprintId: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('updateWorkItem', () => {
  it('envia PATCH con identificadores codificados, payload parcial y retorna el item', async () => {
    const projectId = 'project/con espacio';
    const workItemId = 'item/123';
    const input: UpdateWorkItemInput = { title: 'Titulo actualizado' };
    const item = itemDePrueba({ id: workItemId, projectId, title: input.title });
    const url = `${BASE_URL}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(
      workItemId,
    )}`;
    let payload: unknown;
    let method: string | undefined;

    server.use(
      http.patch(url, async ({ request }) => {
        method = request.method;
        payload = await request.json();
        return HttpResponse.json({ item });
      }),
    );

    await expect(updateWorkItem(projectId, workItemId, input)).resolves.toEqual(item);
    expect(method).toBe('PATCH');
    expect(payload).toEqual({ title: 'Titulo actualizado' });
  });
});

describe('listWorkItems', () => {
  it('envia un filtro individual junto con la paginacion', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], page: 2, pageSize: 10, total: 0 });
      }),
    );

    await listWorkItems(PROJECT_ID, 2, 10, { type: 'BUG' });

    expect(query?.get('type')).toBe('BUG');
    expect(query?.get('page')).toBe('2');
    expect(query?.get('pageSize')).toBe('10');
  });

  it('serializa filtros combinados de forma segura', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], page: 1, pageSize: 20, total: 0 });
      }),
    );

    await listWorkItems('project /?', 1, 20, {
      q: 'login y permisos',
      type: 'BUG',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assigneeId: 'user_123',
    });

    expect([...(query ?? new URLSearchParams()).entries()]).toEqual([
      ['page', '1'],
      ['pageSize', '20'],
      ['q', 'login y permisos'],
      ['type', 'BUG'],
      ['status', 'IN_PROGRESS'],
      ['priority', 'HIGH'],
      ['assigneeId', 'user_123'],
    ]);
  });

  it('omite filtros vacios o undefined y conserva la query de MIR-12', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(WORK_ITEMS_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], page: 1, pageSize: 20, total: 0 });
      }),
    );

    await listWorkItems(PROJECT_ID, 1, 20, {
      q: '   ',
      assigneeId: '',
      type: undefined,
      status: undefined,
      priority: undefined,
    });

    expect([...new Set(query?.keys())]).toEqual(['page', 'pageSize']);
  });
});

describe('deleteWorkItem', () => {
  it('codifica ambos identificadores y acepta 204 sin body', async () => {
    const url = 'http://localhost:3000/api/projects/project%2Fcon%20espacio/work-items/item%2F123';
    const requests: Request[] = [];
    server.use(
      http.delete(url, ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(deleteWorkItem('project/con espacio', 'item/123')).resolves.toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(url);
    expect(requests[0]?.method).toBe('DELETE');
    expect(requests[0]?.credentials).toBe('include');
    await expect(requests[0]?.text()).resolves.toBe('');
  });

  it('conserva el error tipado del servidor', async () => {
    server.use(
      http.delete('http://localhost:3000/api/projects/p/work-items/i', () =>
        apiError(403, 'FORBIDDEN', 'Sin permiso'),
      ),
    );
    await expect(deleteWorkItem('p', 'i')).rejects.toBeInstanceOf(ApiRequestError);
    await expect(deleteWorkItem('p', 'i')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Sin permiso',
    });
  });
});
