import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/jwt';
import { requireAdmin } from '@/lib/auth/roles';
import { logActivity } from '@/lib/services/activityLogger';
import { OPERATIONS } from '@/lib/constants/operations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error!;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const feedbackId = parseInt(id);

    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status, priority, adminNotes } = body;

    const updateData: {
      updated_at: Date;
      status?: string;
      resolved_at?: Date;
      resolved_by?: number;
      priority?: string | null;
      admin_notes?: string | null;
    } = {
      updated_at: new Date(),
    };

    if (status !== undefined) {
      if (!['pending', 'in-review', 'resolved', 'dismissed'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
      
      if (status === 'resolved') {
        updateData.resolved_at = new Date();
        updateData.resolved_by = session.userId;
      }
    }

    if (priority !== undefined) {
      if (priority !== null && !['low', 'medium', 'high', 'critical'].includes(priority)) {
        return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
      }
      updateData.priority = priority;
    }

    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes;
    }

    const feedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: updateData,
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.FEEDBACK_UPDATE,
      description: `Feedback actualizado: ${feedback.subject}${status ? ` (estado: ${status})` : ''}`,
      entityType: 'feedback',
      entityId: feedback.id,
      details: { 
        subject: feedback.subject,
        status: feedback.status,
        priority: feedback.priority,
      },
    });

    return NextResponse.json({
      id: Number(feedback.id),
      userId: feedback.user_id,
      username: feedback.username,
      fullName: feedback.full_name,
      type: feedback.type,
      subject: feedback.subject,
      description: feedback.description,
      status: feedback.status,
      priority: feedback.priority,
      adminNotes: feedback.admin_notes,
      resolvedAt: feedback.resolved_at ? feedback.resolved_at.toISOString() : null,
      resolvedBy: feedback.resolved_by,
      createdAt: feedback.created_at.toISOString(),
      updatedAt: feedback.updated_at.toISOString(),
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
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
    const feedbackId = parseInt(id);

    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Get feedback info before deletion for logging
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    await prisma.feedback.delete({
      where: { id: feedbackId },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.FEEDBACK_DELETE,
      description: `Feedback eliminado: ${feedback.subject}`,
      entityType: 'feedback',
      entityId: BigInt(feedbackId),
      details: { subject: feedback.subject, type: feedback.type },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

