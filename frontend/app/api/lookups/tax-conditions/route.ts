import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const taxConditions = await prisma.tax_conditions.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(taxConditions);
  } catch (error) {
    console.error('Error fetching tax conditions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax conditions' },
      { status: 500 }
    );
  }
}



