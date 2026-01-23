import { NextRequest } from 'next/server';
import { extractPaginationParams } from '../extractParams';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../responses';

describe('extractPaginationParams', () => {
  function createRequest(params: Record<string, string> = {}) {
    const url = new URL('http://localhost:3000/api/test');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url);
  }

  it('returns defaults when no params provided', () => {
    const request = createRequest();
    const result = extractPaginationParams(request);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.search).toBeUndefined();
    expect(result.offset).toBe(0);
  });

  it('extracts page and limit from URL', () => {
    const request = createRequest({ page: '3', limit: '20' });
    const result = extractPaginationParams(request);

    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40);
  });

  it('extracts search param', () => {
    const request = createRequest({ search: 'brida' });
    const result = extractPaginationParams(request);

    expect(result.search).toBe('brida');
  });

  it('uses custom defaults', () => {
    const request = createRequest();
    const result = extractPaginationParams(request, { page: 1, limit: 10 });

    expect(result.limit).toBe(10);
  });

  it('clamps page to minimum of 1', () => {
    const request = createRequest({ page: '0' });
    const result = extractPaginationParams(request);

    expect(result.page).toBe(1);
  });

  it('clamps negative page to 1', () => {
    const request = createRequest({ page: '-5' });
    const result = extractPaginationParams(request);

    expect(result.page).toBe(1);
  });

  it('clamps limit to maximum of 200', () => {
    const request = createRequest({ limit: '500' });
    const result = extractPaginationParams(request);

    expect(result.limit).toBe(200);
  });

  it('clamps limit to minimum of 1', () => {
    const request = createRequest({ limit: '0' });
    const result = extractPaginationParams(request);

    expect(result.limit).toBe(1);
  });

  it('calculates correct offset for page 2 limit 25', () => {
    const request = createRequest({ page: '2', limit: '25' });
    const result = extractPaginationParams(request);

    expect(result.offset).toBe(25);
  });

  it('handles NaN page gracefully', () => {
    const request = createRequest({ page: 'abc' });
    const result = extractPaginationParams(request);

    expect(result.page).toBe(1);
  });

  it('handles NaN limit gracefully', () => {
    const request = createRequest({ limit: 'abc' });
    const result = extractPaginationParams(request);

    expect(result.limit).toBe(50);
  });
});

describe('successResponse', () => {
  it('returns 200 with data', async () => {
    const data = { id: 1, name: 'Test' };
    const response = successResponse(data);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(data);
  });

  it('accepts custom status code', async () => {
    const response = successResponse({ ok: true }, 202);
    expect(response.status).toBe(202);
  });
});

describe('createdResponse', () => {
  it('returns 201 with data', async () => {
    const data = { id: 42, name: 'New Item' };
    const response = createdResponse(data);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual(data);
  });
});

describe('paginatedResponse', () => {
  it('returns data with pagination metadata', async () => {
    const response = paginatedResponse({
      items: [{ id: 1 }, { id: 2 }],
      total: 50,
      page: 2,
      limit: 10,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
  });

  it('calculates totalPages correctly with remainder', async () => {
    const response = paginatedResponse({
      items: [],
      total: 51,
      page: 1,
      limit: 10,
    });

    const body = await response.json();
    expect(body.pagination.totalPages).toBe(6);
  });

  it('handles empty results', async () => {
    const response = paginatedResponse({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    const body = await response.json();
    expect(body.data).toHaveLength(0);
    expect(body.pagination.totalPages).toBe(0);
  });
});

describe('noContentResponse', () => {
  it('returns 204 with null body', () => {
    const response = noContentResponse();
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });
});
