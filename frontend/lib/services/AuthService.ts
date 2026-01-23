import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { createToken, setAuthCookie, getSession, clearAuthCookie } from '@/lib/auth/jwt';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResult {
  user: {
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: string;
  };
  token: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
  request: NextRequest
): Promise<{ data?: LoginResult; error?: string; status: number }> {
  const user = await prisma.users.findUnique({ where: { username } });

  if (!user) {
    return { error: 'Invalid credentials', status: 401 };
  }

  if (!user.is_active) {
    return { error: 'Account is inactive', status: 401 };
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return { error: 'Invalid credentials', status: 401 };
  }

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const token = await createToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role.toLowerCase(),
    fullName: user.full_name,
  });

  await setAuthCookie(token);

  await logActivity({
    request,
    operation: OPERATIONS.LOGIN,
    description: `Usuario ${user.username} inició sesión`,
    entityType: 'user',
    entityId: user.id,
    username: user.username,
  });

  return {
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role.toLowerCase(),
      },
      token,
    },
    status: 200,
  };
}

export async function validateSession() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return {
    id: session.userId,
    username: session.username,
    email: session.email,
    fullName: session.fullName,
    role: session.role,
  };
}

export async function logout() {
  await clearAuthCookie();
}
