import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapClientToDTO } from '@/lib/utils/mapper';
import { createClientSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import { calculateClientSalesTrends } from '@/lib/services/clientSalesTrends';
import { calculateClientClassification } from '@/lib/services/clientClassification';
import type { ClientDto } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const includeTrends = searchParams.get('includeTrends') === 'true';
    const includeClassification = searchParams.get('includeClassification') === 'true';
    const trendMonths = parseInt(searchParams.get('trendMonths') || '12');
    const classificationStatus = searchParams.get('classificationStatus') || null;

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

    // Get trends data if requested
    let trendsData: { data: Map<string, number[]>; labels: string[] } | null = null;
    if (includeTrends) {
      try {
        trendsData = await calculateClientSalesTrends(trendMonths);
      } catch (error) {
        console.error('Error getting client trends:', error);
        // Continue without trends in case of error
      }
    }

    // Get classification data if requested or if filtering by status
    let classificationData: Awaited<ReturnType<typeof calculateClientClassification>> | null = null;
    if (includeClassification || classificationStatus) {
      try {
        classificationData = await calculateClientClassification({ trendMonths });
      } catch (error) {
        console.error('Error getting client classification:', error);
        // Continue without classification in case of error
      }
    }

    // If filtering by classification status, get the client IDs first
    if (classificationStatus && classificationData) {
      const statusClients = classificationData.byStatus[classificationStatus as keyof typeof classificationData.byStatus];
      if (statusClients) {
        const clientIds = statusClients.clients.map(c => BigInt(c.clientId));
        where.id = { in: clientIds };
      }
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
    const mappedClients = clients.map((client) => {
      const baseDto = mapClientToDTO(client);
      const clientId = client.id.toString();
      
      // Build enriched DTO with optional fields
      const dto = {
        ...baseDto,
      } as ClientDto;

      // Add trends if available
      if (trendsData) {
        dto.salesTrend = trendsData.data.get(clientId) || [];
        dto.salesTrendLabels = trendsData.labels;
      }

      // Add classification if available
      if (classificationData) {
        const clientMetrics = Object.values(classificationData.byStatus)
          .flatMap(group => group.clients)
          .find(c => c.clientId === clientId);
        
        if (clientMetrics) {
          dto.clientStatus = clientMetrics.status;
          dto.daysSinceLastPurchase = clientMetrics.daysSinceLastPurchase;
          dto.lastPurchaseDate = clientMetrics.lastPurchaseDate?.toISOString() || null;
          dto.rfmScore = clientMetrics.rfmScore;
        }
      }
      
      return dto;
    });

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

    // Si no se proporciona payment_term_id, usar 1 como default (Pago Contado)
    const paymentTermId = validatedData.paymentTermId || 1;

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
        payment_term_id: paymentTermId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        tax_conditions: true,
        provinces: true,
        operation_types: true,
        transporters: true,
        payment_terms: true,
      },
    });

    // Map to DTO format
    const mappedClient = mapClientToDTO(client);

    // Track creation
    const tracker = new ChangeTracker();
    tracker.trackCreate('client', client.id, client);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.CLIENT_CREATE,
      description: `Cliente ${client.business_name} (${client.code}) creado`,
      entityType: 'client',
      entityId: client.id,
      details: { code: client.code, businessName: client.business_name }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

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

