import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapClientToDTO } from '@/lib/utils/mapper';
import { createClientSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createClientSchema.parse(body);

    // Convert camelCase to snake_case for Prisma
    const client = await prisma.clients.create({
      data: {
        code: validatedData.code,
        business_name: validatedData.businessName,
        cuit: validatedData.cuit,
        tax_condition_id: validatedData.taxConditionId,
        address: validatedData.address,
        city: validatedData.city,
        postal_code: validatedData.postalCode,
        province_id: validatedData.provinceId,
        phone: validatedData.phone,
        email: validatedData.email || null,
        operation_type_id: validatedData.operationTypeId,
        transporter_id: validatedData.transporterId,
        seller_id: validatedData.sellerId,
        credit_limit: validatedData.creditLimit,
        is_active: validatedData.isActive ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        tax_conditions: true,
        provinces: true,
        operation_types: true,
        transporters: true,
      },
    });

    // Map to DTO format
    const mappedClient = mapClientToDTO(client);

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CLIENT_CREATE,
      description: `Cliente ${client.business_name} (${client.code}) creado`,
      entityType: 'client',
      entityId: client.id,
      details: { code: client.code, businessName: client.business_name }
    });

    return NextResponse.json(mappedClient, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}

