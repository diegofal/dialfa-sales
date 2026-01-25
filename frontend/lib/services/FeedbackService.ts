import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/utils/activityLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackListParams {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  userId?: number;
  isAdmin: boolean;
}

export interface CreateFeedbackData {
  type: string;
  subject: string;
  description: string;
}

export interface UpdateFeedbackData {
  status?: string;
  priority?: string | null;
  adminNotes?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeedbackToDTO(feedback: any) {
  return {
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
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: FeedbackListParams) {
  const { page, limit, status, type, userId, isAdmin } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (!isAdmin && userId) {
    where.user_id = userId;
  }
  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }

  const [total, feedbacks] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: feedbacks.map(mapFeedbackToDTO),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function create(
  data: CreateFeedbackData,
  session: { userId: number; username: string; fullName?: string },
  request: NextRequest
) {
  const validTypes = ['bug', 'improvement', 'feature', 'other'];
  if (!validTypes.includes(data.type)) {
    return { error: 'Invalid type', status: 400 };
  }

  const now = new Date();

  const feedback = await prisma.feedback.create({
    data: {
      user_id: session.userId,
      username: session.username,
      full_name: session.fullName || session.username,
      type: data.type,
      subject: data.subject,
      description: data.description,
      status: 'pending',
      created_at: now,
      updated_at: now,
    },
  });

  await logActivity({
    request,
    operation: OPERATIONS.FEEDBACK_CREATE,
    description: `Feedback creado: ${data.subject} (${data.type})`,
    entityType: 'feedback',
    entityId: feedback.id,
    details: { type: data.type, subject: data.subject },
  });

  return { data: mapFeedbackToDTO(feedback), status: 201 };
}

export async function update(
  id: number,
  data: UpdateFeedbackData,
  session: { userId: number },
  request: NextRequest
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { updated_at: new Date() };

  if (data.status !== undefined) {
    const validStatuses = ['pending', 'in-review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(data.status)) {
      return { error: 'Invalid status', status: 400 };
    }
    updateData.status = data.status;

    if (data.status === 'resolved') {
      updateData.resolved_at = new Date();
      updateData.resolved_by = session.userId;
    }
  }

  if (data.priority !== undefined) {
    if (data.priority !== null) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(data.priority)) {
        return { error: 'Invalid priority', status: 400 };
      }
    }
    updateData.priority = data.priority;
  }

  if (data.adminNotes !== undefined) {
    updateData.admin_notes = data.adminNotes;
  }

  const feedback = await prisma.feedback.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    request,
    operation: OPERATIONS.FEEDBACK_UPDATE,
    description: `Feedback actualizado: ${feedback.subject}${data.status ? ` (estado: ${data.status})` : ''}`,
    entityType: 'feedback',
    entityId: feedback.id,
    details: { subject: feedback.subject, status: feedback.status, priority: feedback.priority },
  });

  return { data: mapFeedbackToDTO(feedback), status: 200 };
}

export async function remove(id: number, request: NextRequest) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });

  if (!feedback) {
    return null;
  }

  await prisma.feedback.delete({ where: { id } });

  await logActivity({
    request,
    operation: OPERATIONS.FEEDBACK_DELETE,
    description: `Feedback eliminado: ${feedback.subject}`,
    entityType: 'feedback',
    entityId: BigInt(id),
    details: { subject: feedback.subject, type: feedback.type },
  });

  return true;
}
