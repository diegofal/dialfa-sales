import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import bcrypt from 'bcryptjs';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

export async function GET(request: NextRequest) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      prisma.users.count(),
      prisma.users.findMany({
        orderBy: { username: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const serializedUsers = users.map(user => {
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
    });

    return NextResponse.json({
      data: serializedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error;

    const body = await request.json();
    const { username, email, fullName, role, password } = body;

    if (!username || !email || !fullName || !role || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();

    const user = await prisma.users.create({
      data: {
        username,
        email,
        full_name: fullName,
        role,
        password_hash: hashedPassword,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });

    await logActivity({
      request,
      operation: OPERATIONS.USER_CREATE,
      description: `Usuario ${username} creado con rol ${role}`,
      entityType: 'user',
      entityId: user.id,
      details: { username, role, fullName },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

