import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const operationTypes = await prisma.operation_types.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(operationTypes);
  } catch (error) {
    console.error('Error fetching operation types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operation types' },
      { status: 500 }
    );
  }
}



