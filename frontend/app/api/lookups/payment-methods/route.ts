import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET() {
  try {
    const paymentMethods = await prisma.payment_methods.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(paymentMethods);
  } catch (error) {
    return handleError(error);
  }
}
