import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const transporterId = Number(id);

    if (isNaN(transporterId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await prisma.transporters.update({
      where: { id: transporterId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
