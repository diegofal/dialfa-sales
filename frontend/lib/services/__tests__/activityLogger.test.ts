import { NextRequest } from 'next/server';
import { logActivity } from '../activityLogger';

// Mock prisma
const mockCreate = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    activity_logs: {
      get create() {
        return mockCreate;
      },
    },
  },
}));

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: new Headers(headers),
  });
}

describe('logActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 1n });
  });

  it('creates an activity log with required fields', async () => {
    const request = createMockRequest({ 'x-user-id': '5', 'x-user-name': 'admin' });

    await logActivity({
      request,
      operation: 'CREATE',
      description: 'Created a new sales order',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 5,
        username: 'admin',
        operation: 'CREATE',
        description: 'Created a new sales order',
      }),
    });
  });

  it('extracts user_id from x-user-id header', async () => {
    const request = createMockRequest({ 'x-user-id': '42' });

    await logActivity({ request, operation: 'READ', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ user_id: 42 }),
    });
  });

  it('sets user_id to null when header is missing', async () => {
    const request = createMockRequest({});

    await logActivity({ request, operation: 'READ', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ user_id: null }),
    });
  });

  it('uses username override over header value', async () => {
    const request = createMockRequest({ 'x-user-name': 'header-user' });

    await logActivity({
      request,
      operation: 'UPDATE',
      description: 'Test',
      username: 'manual-override',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ username: 'manual-override' }),
    });
  });

  it('uses x-user-name header when no override', async () => {
    const request = createMockRequest({ 'x-user-name': 'header-user' });

    await logActivity({ request, operation: 'UPDATE', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ username: 'header-user' }),
    });
  });

  it('defaults username to "unknown" when no header or override', async () => {
    const request = createMockRequest({});

    await logActivity({ request, operation: 'UPDATE', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ username: 'unknown' }),
    });
  });

  it('extracts IP from x-forwarded-for header (first IP)', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.100, 10.0.0.1',
    });

    await logActivity({ request, operation: 'READ', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_address: '192.168.1.100' }),
    });
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const request = createMockRequest({ 'x-real-ip': '10.0.0.5' });

    await logActivity({ request, operation: 'READ', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_address: '10.0.0.5' }),
    });
  });

  it('sets ip_address to null when no IP headers', async () => {
    const request = createMockRequest({});

    await logActivity({ request, operation: 'READ', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_address: null }),
    });
  });

  it('stores entityType and entityId when provided', async () => {
    const request = createMockRequest({ 'x-user-id': '1' });

    await logActivity({
      request,
      operation: 'UPDATE',
      description: 'Updated order',
      entityType: 'sales_order',
      entityId: 100n,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity_type: 'sales_order',
        entity_id: 100n,
      }),
    });
  });

  it('sets entity fields to null when not provided', async () => {
    const request = createMockRequest({});

    await logActivity({ request, operation: 'READ', description: 'Test' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity_type: null,
        entity_id: null,
      }),
    });
  });

  it('stores details as JSON when provided', async () => {
    const request = createMockRequest({});
    const details = { oldStatus: 'PENDING', newStatus: 'CONFIRMED' };

    await logActivity({
      request,
      operation: 'UPDATE',
      description: 'Status changed',
      details,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ details }),
    });
  });

  it('returns the created activity log id', async () => {
    mockCreate.mockResolvedValue({ id: 55n });
    const request = createMockRequest({});

    const result = await logActivity({ request, operation: 'CREATE', description: 'Test' });

    expect(result).toBe(55n);
  });

  it('returns null and does not throw when prisma fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection lost'));
    const request = createMockRequest({});

    const result = await logActivity({ request, operation: 'CREATE', description: 'Test' });

    expect(result).toBeNull();
  });

  it('converts number entityId to BigInt', async () => {
    const request = createMockRequest({});

    await logActivity({
      request,
      operation: 'DELETE',
      description: 'Deleted item',
      entityId: 42,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity_id: 42n }),
    });
  });
});
