import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET() {
  try {
    const provinces = await prisma.provinces.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(provinces);
  } catch (error) {
    return handleError(error);
  }
}
