import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET() {
  try {
    const transporters = await prisma.transporters.findMany({
      where: {
        is_active: true,
        deleted_at: null,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(transporters);
  } catch (error) {
    return handleError(error);
  }
}
