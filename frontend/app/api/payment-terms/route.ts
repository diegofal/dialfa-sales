import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where = activeOnly ? { is_active: true } : {};

    const paymentTerms = await prisma.payment_terms.findMany({
      where,
      orderBy: { days: 'asc' },
    });

    return NextResponse.json({
      data: paymentTerms.map(pt => ({
        id: pt.id,
        code: pt.code,
        name: pt.name,
        days: pt.days,
        isActive: pt.is_active,
      })),
    });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment terms' },
      { status: 500 }
    );
  }
}
