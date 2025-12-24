import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const statusFilter = searchParams.get('status') || undefined;
    const typeFilter = searchParams.get('type') || undefined;
    
    // Admins can see all feedback, users can only see their own
    const isAdmin = session.role?.toLowerCase() === 'admin';
    
    const where: any = {};
    if (!isAdmin) {
      where.user_id = session.userId;
    }
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (typeFilter) {
      where.type = typeFilter;
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

    const serializedFeedbacks = feedbacks.map(feedback => ({
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
    }));

    return NextResponse.json({
      data: serializedFeedbacks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, subject, description } = body;

    if (!type || !subject || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['bug', 'improvement', 'feature', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const now = new Date();

    const feedback = await prisma.feedback.create({
      data: {
        user_id: session.userId,
        username: session.username,
        full_name: session.fullName || session.username,
        type,
        subject,
        description,
        status: 'pending',
        created_at: now,
        updated_at: now,
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
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

