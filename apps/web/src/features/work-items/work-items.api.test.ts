import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiError } from '@/test/msw/handlers';
import { ApiRequestError } from '@/lib/api-client';
import { deleteWorkItem } from './work-items.api';

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
