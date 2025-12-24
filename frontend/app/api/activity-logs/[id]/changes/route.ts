import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error;

    const { id } = await params;
    const activityLogId = BigInt(id);

    const changes = await prisma.activity_changes.findMany({
      where: { activity_log_id: activityLogId },
      orderBy: { created_at: 'asc' },
    });

    const serializedChanges = changes.map(change => ({
      id: Number(change.id),
      entityType: change.entity_type,
      entityId: change.entity_id ? Number(change.entity_id) : null,
      entityLabel: change.entity_label,
      beforeState: change.before_state,
      afterState: change.after_state,
      createdAt: change.created_at.toISOString(),
    }));

    return NextResponse.json({ data: serializedChanges });
  } catch (error) {
    console.error('Error fetching activity changes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

