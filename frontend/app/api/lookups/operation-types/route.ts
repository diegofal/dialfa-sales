import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET() {
  try {
    const operationTypes = await prisma.operation_types.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(operationTypes);
  } catch (error) {
    return handleError(error);
  }
}
