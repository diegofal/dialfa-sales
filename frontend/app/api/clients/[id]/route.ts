import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const client = await prisma.clients.findUnique({
      where: { id },
      include: {
        tax_conditions: true,
        provinces: true,
        operation_types: true,
        transporters: true,
        client_discounts: {
          include: {
            categories: true,
          },
        },
      },
    });

    if (!client || client.deleted_at) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const serializedClient = {
      ...client,
      id: client.id.toString(),
      client_discounts: client.client_discounts.map(discount => ({
        ...discount,
        id: discount.id.toString(),
        client_id: discount.client_id.toString(),
        category_id: discount.category_id.toString(),
        categories: {
          ...discount.categories,
          id: discount.categories.id.toString(),
        },
      })),
    };

    return NextResponse.json(serializedClient);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 }
    );
  }
}

