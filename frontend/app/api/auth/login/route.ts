import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user by username
    const user = await prisma.users.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role.toLowerCase(), // Normalize role to lowercase
      fullName: user.full_name,
    });

    // Set auth cookie
    await setAuthCookie(token);

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.LOGIN,
      description: `Usuario ${user.username} inició sesión`,
      entityType: 'user',
      entityId: user.id,
      username: user.username, // Pass username explicitly since middleware skips this route
    });

    // Return user data (without password hash)
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role.toLowerCase(), // Normalize role to lowercase
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



