import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserListParams {
  page: number;
  limit: number;
}

export interface CreateUserData {
  username: string;
  email: string;
  fullName: string;
  role: string;
  password: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  fullName?: string;
  role?: string;
  password?: string;
  isActive?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeUser(user: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = user;
  return {
    ...rest,
    isActive: user.is_active,
    fullName: user.full_name,
    lastLoginAt: user.last_login_at ? user.last_login_at.toISOString() : null,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: UserListParams) {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  const [total, users] = await Promise.all([
    prisma.users.count(),
    prisma.users.findMany({
      orderBy: { username: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: users.map(serializeUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getById(id: number) {
  const user = await prisma.users.findUnique({ where: { id } });

  if (!user) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...userWithoutPassword } = user;
  return { ...userWithoutPassword, isActive: user.is_active, fullName: user.full_name };
}

export async function create(data: CreateUserData, request: NextRequest) {
  const existingUser = await prisma.users.findFirst({
    where: { OR: [{ username: data.username }, { email: data.email }] },
  });

  if (existingUser) {
    return { error: 'Username or email already exists', status: 400 };
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const now = new Date();

  const user = await prisma.users.create({
    data: {
      username: data.username,
      email: data.email,
      full_name: data.fullName,
      role: data.role,
      password_hash: hashedPassword,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  });

  const tracker = new ChangeTracker();
  tracker.trackCreate('user', user.id, user);

  await logActivity({
    request,
    operation: OPERATIONS.USER_CREATE,
    description: `Usuario ${data.username} creado con rol ${data.role}`,
    entityType: 'user',
    entityId: user.id,
    details: { username: data.username, role: data.role, fullName: data.fullName },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...userWithoutPassword } = user;
  return { data: userWithoutPassword, status: 201 };
}

export async function update(id: number, data: UpdateUserData, request: NextRequest) {
  const existingUser = await prisma.users.findUnique({ where: { id } });

  if (!existingUser) {
    return { error: 'User not found', status: 404 };
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('user', id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    username: data.username,
    email: data.email,
    full_name: data.fullName,
    role: data.role,
    is_active: data.isActive,
    updated_at: new Date(),
  };

  if (data.password) {
    updateData.password_hash = await bcrypt.hash(data.password, 10);
  }

  const updatedUser = await prisma.users.update({ where: { id }, data: updateData });

  await tracker.trackAfter('user', id);

  await logActivity({
    request,
    operation: OPERATIONS.USER_UPDATE,
    description: `Usuario ${data.username} actualizado`,
    entityType: 'user',
    entityId: updatedUser.id,
    details: {
      username: data.username,
      role: data.role,
      fullName: data.fullName,
      isActive: data.isActive,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...userWithoutPassword } = updatedUser;
  return { data: userWithoutPassword, status: 200 };
}

export async function deactivate(id: number, request: NextRequest) {
  const user = await prisma.users.findUnique({ where: { id } });

  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('user', id, user);

  await prisma.users.update({
    where: { id },
    data: { is_active: false, updated_at: new Date() },
  });

  await logActivity({
    request,
    operation: OPERATIONS.USER_DEACTIVATE,
    description: `Usuario ${user.username} desactivado`,
    entityType: 'user',
    entityId: user.id,
  });

  return { status: 200 };
}
