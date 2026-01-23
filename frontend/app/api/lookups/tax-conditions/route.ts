import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET() {
  try {
    const taxConditions = await prisma.tax_conditions.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(taxConditions);
  } catch (error) {
    return handleError(error);
  }
}
