import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { UpdateWorkItemInput, WorkItemDto } from '@mira/shared';
import { server } from '@/test/msw/server';
import { updateWorkItem } from './work-items.api';

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
