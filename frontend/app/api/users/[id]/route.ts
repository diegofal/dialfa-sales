import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import bcrypt from 'bcryptjs';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error!;

    const { id } = await params;
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = user;
    return NextResponse.json({
      ...userWithoutPassword,
      isActive: user.is_active,
      fullName: user.full_name,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error!;

    const { id } = await params;
    const body = await request.json();
    const { username, email, fullName, role, password, isActive } = body;

    // Track before state
    const tracker = new ChangeTracker();
    await tracker.trackBefore('user', parseInt(id));

    const existingUser = await prisma.users.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      username,
      email,
      full_name: fullName,
      role,
      is_active: isActive,
      updated_at: new Date(),
    };

    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.users.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // Track after state
    await tracker.trackAfter('user', parseInt(id));

    await logActivity({
      request,
      operation: OPERATIONS.USER_UPDATE,
      description: `Usuario ${username} actualizado`,
      entityType: 'user',
      entityId: updatedUser.id,
      details: { username, role, fullName, isActive },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = updatedUser;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error!;

    const { id } = await params;
    const userId = parseInt(id);

    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Track deletion (deactivation)
    const tracker = new ChangeTracker();
    tracker.trackDelete('user', userId, user);

    // Soft delete by setting is_active to false
    await prisma.users.update({
      where: { id: userId },
      data: { is_active: false, updated_at: new Date() },
    });

    await logActivity({
      request,
      operation: OPERATIONS.USER_DEACTIVATE,
      description: `Usuario ${user.username} desactivado`,
      entityType: 'user',
      entityId: user.id,
    });

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

