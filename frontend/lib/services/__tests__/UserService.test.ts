import { NextRequest } from 'next/server';
import { list, getById, create, update, deactivate } from '../UserService';

// Mock dependencies
const mockCount = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    users: {
      get count() {
        return mockCount;
      },
      get findMany() {
        return mockFindMany;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get findFirst() {
        return mockFindFirst;
      },
      get create() {
        return mockCreate;
      },
      get update() {
        return mockUpdate;
      },
    },
  },
}));

const mockHash = jest.fn().mockResolvedValue('$2a$10$hashed');
jest.mock('bcryptjs', () => ({
  hash: (...args: unknown[]) => mockHash(...args),
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

jest.mock('@/lib/utils/changeTracker', () => ({
  ChangeTracker: jest.fn().mockImplementation(() => ({
    trackBefore: jest.fn().mockResolvedValue(undefined),
    trackAfter: jest.fn().mockResolvedValue(undefined),
    trackCreate: jest.fn(),
    trackDelete: jest.fn(),
    saveChanges: jest.fn().mockResolvedValue(undefined),
  })),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/users', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockUser = {
  id: 1,
  username: 'john',
  email: 'john@test.com',
  full_name: 'John Doe',
  role: 'operator',
  password_hash: '$2a$10$hash',
  is_active: true,
  last_login_at: new Date('2024-06-01'),
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
};

describe('list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated user list without password_hash', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([mockUser]);

    const result = await list({ page: 1, limit: 10 });

    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(result.data[0]).not.toHaveProperty('password_hash');
    expect(result.data[0].fullName).toBe('John Doe');
    expect(result.data[0].isActive).toBe(true);
  });

  it('calculates skip from page and limit', async () => {
    mockCount.mockResolvedValue(25);
    mockFindMany.mockResolvedValue([]);

    await list({ page: 3, limit: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
  });

  it('calculates totalPages correctly', async () => {
    mockCount.mockResolvedValue(25);
    mockFindMany.mockResolvedValue([]);

    const result = await list({ page: 1, limit: 10 });
    expect(result.pagination.totalPages).toBe(3);
  });
});

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns user without password when found', async () => {
    mockFindUnique.mockResolvedValue(mockUser);

    const result = await getById(1);

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('password_hash');
    expect(result?.isActive).toBe(true);
    expect(result?.fullName).toBe('John Doe');
  });

  it('returns null when user not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999);
    expect(result).toBeNull();
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns error when username or email already exists', async () => {
    mockFindFirst.mockResolvedValue(mockUser);

    const result = await create(
      {
        username: 'john',
        email: 'john@test.com',
        fullName: 'John',
        role: 'operator',
        password: 'pass',
      },
      createMockRequest()
    );

    expect(result.status).toBe(400);
    expect(result.error).toBe('Username or email already exists');
  });

  it('hashes the password before storing', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ ...mockUser, id: 2 });

    await create(
      {
        username: 'new',
        email: 'new@test.com',
        fullName: 'New User',
        role: 'admin',
        password: 'secret123',
      },
      createMockRequest()
    );

    expect(mockHash).toHaveBeenCalledWith('secret123', 10);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ password_hash: '$2a$10$hashed' }),
    });
  });

  it('returns 201 on success without password_hash', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ ...mockUser, id: 2 });

    const result = await create(
      {
        username: 'new',
        email: 'new@test.com',
        fullName: 'New',
        role: 'operator',
        password: 'pass',
      },
      createMockRequest()
    );

    expect(result.status).toBe(201);
    expect(result.data).not.toHaveProperty('password_hash');
  });
});

describe('update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await update(999, { username: 'x' }, createMockRequest());
    expect(result.status).toBe(404);
    expect(result.error).toBe('User not found');
  });

  it('hashes new password if provided', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockUpdate.mockResolvedValue(mockUser);

    await update(1, { password: 'newpass' }, createMockRequest());

    expect(mockHash).toHaveBeenCalledWith('newpass', 10);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ password_hash: '$2a$10$hashed' }),
    });
  });

  it('does not hash password if not provided', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockUpdate.mockResolvedValue(mockUser);

    await update(1, { username: 'updated' }, createMockRequest());

    expect(mockHash).not.toHaveBeenCalled();
  });

  it('returns 200 on success without password_hash', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockUpdate.mockResolvedValue(mockUser);

    const result = await update(1, { username: 'updated' }, createMockRequest());
    expect(result.status).toBe(200);
    expect(result.data).not.toHaveProperty('password_hash');
  });
});

describe('deactivate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await deactivate(999, createMockRequest());
    expect(result.status).toBe(404);
  });

  it('sets is_active to false', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockUpdate.mockResolvedValue({ ...mockUser, is_active: false });

    await deactivate(1, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ is_active: false }),
    });
  });

  it('returns 200 on success', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockUpdate.mockResolvedValue({ ...mockUser, is_active: false });

    const result = await deactivate(1, createMockRequest());
    expect(result.status).toBe(200);
  });
});
