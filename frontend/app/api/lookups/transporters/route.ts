import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
    console.error('Error fetching transporters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transporters' },
      { status: 500 }
    );
  }
}



