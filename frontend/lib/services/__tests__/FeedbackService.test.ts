import { NextRequest } from 'next/server';
import { list, create, update, remove } from '../FeedbackService';

// Mock dependencies
const mockCount = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    feedback: {
      get count() {
        return mockCount;
      },
      get findMany() {
        return mockFindMany;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get create() {
        return mockCreate;
      },
      get update() {
        return mockUpdate;
      },
      get delete() {
        return mockDelete;
      },
    },
  },
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/feedback', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockFeedback = {
  id: 1n,
  user_id: 5,
  username: 'user1',
  full_name: 'User One',
  type: 'bug',
  subject: 'Login fails',
  description: 'Cannot login after update',
  status: 'pending',
  priority: null,
  admin_notes: null,
  resolved_at: null,
  resolved_by: null,
  created_at: new Date('2024-06-01'),
  updated_at: new Date('2024-06-01'),
};

describe('list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated feedback', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([mockFeedback]);

    const result = await list({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
    expect(result.pagination.total).toBe(1);
  });

  it('does not filter by userId for any users', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await list({ page: 1, limit: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ user_id: expect.anything() }),
      })
    );
  });

  it('filters by status and type', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await list({ page: 1, limit: 10, status: 'resolved', type: 'bug' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'resolved', type: 'bug' }),
      })
    );
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for invalid type', async () => {
    const result = await create(
      { type: 'invalid', subject: 'Test', description: 'Desc' },
      { userId: 1, username: 'user1' },
      createMockRequest()
    );

    expect(result.status).toBe(400);
    expect(result.error).toBe('Invalid type');
  });

  it('creates feedback with valid type', async () => {
    mockCreate.mockResolvedValue(mockFeedback);

    const result = await create(
      { type: 'bug', subject: 'Login fails', description: 'Details' },
      { userId: 5, username: 'user1', fullName: 'User One' },
      createMockRequest()
    );

    expect(result.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 5,
        username: 'user1',
        full_name: 'User One',
        type: 'bug',
        subject: 'Login fails',
        status: 'pending',
      }),
    });
  });

  it('accepts all valid types', async () => {
    mockCreate.mockResolvedValue(mockFeedback);

    for (const type of ['bug', 'improvement', 'feature', 'other']) {
      const result = await create(
        { type, subject: 'Test', description: 'Desc' },
        { userId: 1, username: 'user' },
        createMockRequest()
      );
      expect(result.status).toBe(201);
    }
  });

  it('uses username as fullName when not provided', async () => {
    mockCreate.mockResolvedValue(mockFeedback);

    await create(
      { type: 'bug', subject: 'Test', description: 'Desc' },
      { userId: 1, username: 'user1' },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ full_name: 'user1' }),
    });
  });
});

describe('update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for invalid status', async () => {
    const result = await update(1, { status: 'invalid' }, { userId: 1 }, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Invalid status');
  });

  it('returns 400 for invalid priority', async () => {
    const result = await update(1, { priority: 'invalid' }, { userId: 1 }, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Invalid priority');
  });

  it('allows null priority (clearing priority)', async () => {
    mockUpdate.mockResolvedValue({ ...mockFeedback, priority: null });

    const result = await update(1, { priority: null }, { userId: 1 }, createMockRequest());

    expect(result.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ priority: null }),
    });
  });

  it('sets resolved_at and resolved_by when status is resolved', async () => {
    mockUpdate.mockResolvedValue({ ...mockFeedback, status: 'resolved' });

    await update(1, { status: 'resolved' }, { userId: 42 }, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'resolved',
        resolved_at: expect.any(Date),
        resolved_by: 42,
      }),
    });
  });

  it('stores admin notes', async () => {
    mockUpdate.mockResolvedValue({ ...mockFeedback, admin_notes: 'Fixed in v2' });

    await update(1, { adminNotes: 'Fixed in v2' }, { userId: 1 }, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ admin_notes: 'Fixed in v2' }),
    });
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when feedback not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await remove(999, createMockRequest());
    expect(result).toBeNull();
  });

  it('deletes feedback and returns true', async () => {
    mockFindUnique.mockResolvedValue(mockFeedback);
    mockDelete.mockResolvedValue(mockFeedback);

    const result = await remove(1, createMockRequest());

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toBe(true);
  });
});
