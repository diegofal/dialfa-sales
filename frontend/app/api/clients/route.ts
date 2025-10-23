import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapClientToDTO } from '@/lib/utils/mapper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { business_name: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    // Get clients with relations
    const [clients, total] = await Promise.all([
      prisma.clients.findMany({
        where,
        include: {
          tax_conditions: true,
          provinces: true,
          operation_types: true,
          transporters: true,
        },
        orderBy: {
          code: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.clients.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedClients = clients.map(mapClientToDTO);

    return NextResponse.json({
      data: mappedClients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}


