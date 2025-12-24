import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error!;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const operation = searchParams.get('operation');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: Prisma.activity_logsWhereInput = {};

    if (userId) {
      where.user_id = parseInt(userId);
    }

    if (operation) {
      where.operation = operation;
    }

    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) {
        where.created_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to dateTo to include the full day
        const toDate = new Date(dateTo);
        toDate.setDate(toDate.getDate() + 1);
        where.created_at.lt = toDate;
      }
    }

    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [total, logs] = await Promise.all([
      prisma.activity_logs.count({ where }),
      prisma.activity_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Transform BigInt to Number for JSON serialization
    const serializedLogs = logs.map(log => ({
      ...log,
      id: Number(log.id),
      entity_id: log.entity_id ? Number(log.entity_id) : null,
    }));

    return NextResponse.json({
      data: serializedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

