import { NextRequest } from 'next/server';
import { login, validateSession, logout } from '../AuthService';

// Mock dependencies
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    users: {
      get findUnique() {
        return mockFindUnique;
      },
      get update() {
        return mockUpdate;
      },
    },
  },
}));

const mockCompare = jest.fn();
jest.mock('bcryptjs', () => ({
  compare: (...args: unknown[]) => mockCompare(...args),
}));

const mockCreateToken = jest.fn();
const mockSetAuthCookie = jest.fn();
const mockGetSession = jest.fn();
const mockClearAuthCookie = jest.fn();
jest.mock('@/lib/auth/jwt', () => ({
  createToken: (...args: unknown[]) => mockCreateToken(...args),
  setAuthCookie: (...args: unknown[]) => mockSetAuthCookie(...args),
  getSession: () => mockGetSession(),
  clearAuthCookie: () => mockClearAuthCookie(),
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: new Headers({ 'x-user-id': '1' }),
  });
}

const mockUser = {
  id: 1,
  username: 'admin',
  email: 'admin@test.com',
  password_hash: '$2a$10$hashedpassword',
  full_name: 'Admin User',
  role: 'ADMIN',
  is_active: true,
};

describe('login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(mockUser);
    mockCreateToken.mockResolvedValue('mock-jwt-token');
    mockSetAuthCookie.mockResolvedValue(undefined);
  });

  it('returns 401 when user is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await login('nonexistent', 'password', createMockRequest());

    expect(result.status).toBe(401);
    expect(result.error).toBe('Invalid credentials');
    expect(result.data).toBeUndefined();
  });

  it('returns 401 when user account is inactive', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, is_active: false });

    const result = await login('admin', 'password', createMockRequest());

    expect(result.status).toBe(401);
    expect(result.error).toBe('Account is inactive');
  });

  it('returns 401 when password is invalid', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockCompare.mockResolvedValue(false);

    const result = await login('admin', 'wrong-password', createMockRequest());

    expect(result.status).toBe(401);
    expect(result.error).toBe('Invalid credentials');
  });

  it('returns 200 with user data and token on successful login', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockCompare.mockResolvedValue(true);

    const result = await login('admin', 'correct-password', createMockRequest());

    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        fullName: 'Admin User',
        role: 'admin',
      },
      token: 'mock-jwt-token',
    });
  });

  it('lowercases the role in the response', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, role: 'MANAGER' });
    mockCompare.mockResolvedValue(true);

    const result = await login('admin', 'pass', createMockRequest());

    expect(result.data?.user.role).toBe('manager');
  });

  it('updates last_login_at on successful login', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockCompare.mockResolvedValue(true);

    await login('admin', 'pass', createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { last_login_at: expect.any(Date) },
    });
  });

  it('creates a JWT token with correct payload', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockCompare.mockResolvedValue(true);

    await login('admin', 'pass', createMockRequest());

    expect(mockCreateToken).toHaveBeenCalledWith({
      userId: 1,
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
      fullName: 'Admin User',
    });
  });

  it('sets auth cookie after creating token', async () => {
    mockFindUnique.mockResolvedValue(mockUser);
    mockCompare.mockResolvedValue(true);

    await login('admin', 'pass', createMockRequest());

    expect(mockSetAuthCookie).toHaveBeenCalledWith('mock-jwt-token');
  });

  it('does not update last_login or create token on failed login', async () => {
    mockFindUnique.mockResolvedValue(null);

    await login('admin', 'pass', createMockRequest());

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
  });
});

describe('validateSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await validateSession();
    expect(result).toBeNull();
  });

  it('returns user data from session', async () => {
    mockGetSession.mockResolvedValue({
      userId: 5,
      username: 'user1',
      email: 'user1@test.com',
      fullName: 'User One',
      role: 'operator',
    });

    const result = await validateSession();

    expect(result).toEqual({
      id: 5,
      username: 'user1',
      email: 'user1@test.com',
      fullName: 'User One',
      role: 'operator',
    });
  });
});

describe('logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears the auth cookie', async () => {
    await logout();
    expect(mockClearAuthCookie).toHaveBeenCalled();
  });
});
