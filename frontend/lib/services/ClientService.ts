import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/utils/activityLogger';
import { ChangeTracker } from '@/lib/utils/changeTracker';
import {
  calculateClientClassification,
  getClientClassificationCacheInfo,
} from '@/lib/utils/clients/clientClassification';
import { calculateClientSalesTrends } from '@/lib/utils/clients/clientSalesTrends';
import { logger } from '@/lib/utils/logger';
import { mapClientToDTO } from '@/lib/utils/mapper';
import { CreateClientInput, UpdateClientInput } from '@/lib/validations/schemas';
import type { ClientDto } from '@/types/api';
import { ClientClassificationConfig, ClientStatus } from '@/types/clientClassification';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientListParams {
  page: number;
  limit: number;
  search?: string;
  includeTrends?: boolean;
  includeClassification?: boolean;
  trendMonths?: number;
  classificationStatus?: string;
}

export interface ClientListResult {
  data: ClientDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: ClientListParams): Promise<ClientListResult> {
  const {
    page,
    limit,
    search,
    includeTrends,
    includeClassification,
    trendMonths = 12,
    classificationStatus,
  } = params;

  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deleted_at: null };

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
      logger.error('Error getting client trends', {}, error as Error);
    }
  }

  // Get classification data if requested or filtering by status
  let classificationData: Awaited<ReturnType<typeof calculateClientClassification>> | null = null;
  if (includeClassification || classificationStatus) {
    try {
      classificationData = await calculateClientClassification({ trendMonths });
    } catch (error) {
      logger.error('Error getting client classification', {}, error as Error);
    }
  }

  // Filter by classification status
  if (classificationStatus && classificationData) {
    const statusClients =
      classificationData.byStatus[classificationStatus as keyof typeof classificationData.byStatus];
    if (statusClients) {
      const clientIds = statusClients.clients.map((c) => BigInt(c.clientId));
      where.id = { in: clientIds };
    }
  }

  const [clients, total] = await Promise.all([
    prisma.clients.findMany({
      where,
      include: {
        tax_conditions: true,
        provinces: true,
        operation_types: true,
        transporters: true,
      },
      orderBy: { code: 'asc' },
      skip,
      take: limit,
    }),
    prisma.clients.count({ where }),
  ]);

  const mappedClients = clients.map((client) => {
    const baseDto = mapClientToDTO(client);
    const clientId = client.id.toString();
    const dto = { ...baseDto } as ClientDto;

    if (trendsData) {
      dto.salesTrend = trendsData.data.get(clientId) || [];
      dto.salesTrendLabels = trendsData.labels;
    }

    if (classificationData) {
      const clientMetrics = Object.values(classificationData.byStatus)
        .flatMap((group) => group.clients)
        .find((c) => c.clientId === clientId);

      if (clientMetrics) {
        dto.clientStatus = clientMetrics.status;
        dto.daysSinceLastPurchase = clientMetrics.daysSinceLastPurchase;
        dto.lastPurchaseDate = clientMetrics.lastPurchaseDate?.toISOString() || null;
        dto.rfmScore = clientMetrics.rfmScore;
      }
    }

    return dto;
  });

  return {
    data: mappedClients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getById(id: bigint) {
  const client = await prisma.clients.findUnique({
    where: { id },
    include: {
      tax_conditions: true,
      provinces: true,
      operation_types: true,
      transporters: true,
      payment_terms: true,
      client_discounts: {
        include: { categories: true },
      },
    },
  });

  if (!client || client.deleted_at) {
    return null;
  }

  const mappedClient = mapClientToDTO(client);

  return {
    ...mappedClient,
    client_discounts: client.client_discounts.map(
      (discount: (typeof client.client_discounts)[number]) => ({
        id: discount.id.toString(),
        client_id: discount.client_id.toString(),
        category_id: discount.category_id.toString(),
        discount_percent: discount.discount_percent,
        categories: {
          id: discount.categories.id.toString(),
          name: discount.categories.name,
          code: discount.categories.code,
        },
      })
    ),
  };
}

export async function create(data: CreateClientInput, request: NextRequest) {
  const paymentTermId = data.paymentTermId || 1;

  const client = await prisma.clients.create({
    data: {
      code: data.code,
      business_name: data.businessName,
      cuit: data.cuit,
      tax_condition_id: data.taxConditionId,
      address: data.address,
      city: data.city,
      postal_code: data.postalCode,
      province_id: data.provinceId,
      phone: data.phone,
      email: data.email || null,
      operation_type_id: data.operationTypeId,
      transporter_id: data.transporterId,
      seller_id: data.sellerId,
      credit_limit: data.creditLimit,
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

  const tracker = new ChangeTracker();
  tracker.trackCreate('client', client.id, client);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.CLIENT_CREATE,
    description: `Cliente ${client.business_name} (${client.code}) creado`,
    entityType: 'client',
    entityId: client.id,
    details: { code: client.code, businessName: client.business_name },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapClientToDTO(client);
}

export async function update(id: bigint, data: UpdateClientInput) {
  const existingClient = await prisma.clients.findUnique({ where: { id } });

  if (!existingClient || existingClient.deleted_at) {
    return null;
  }

  const client = await prisma.clients.update({
    where: { id },
    data: {
      code: data.code,
      business_name: data.businessName,
      cuit: data.cuit,
      tax_condition_id: data.taxConditionId,
      address: data.address,
      city: data.city,
      postal_code: data.postalCode,
      province_id: data.provinceId,
      phone: data.phone,
      email: data.email || null,
      operation_type_id: data.operationTypeId,
      transporter_id: data.transporterId,
      seller_id: data.sellerId,
      credit_limit: data.creditLimit,
      payment_term_id: data.paymentTermId,
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

  return mapClientToDTO(client);
}

export async function remove(id: bigint) {
  const existingClient = await prisma.clients.findUnique({ where: { id } });

  if (!existingClient || existingClient.deleted_at) {
    return null;
  }

  await prisma.clients.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      updated_at: new Date(),
    },
  });

  return true;
}

export async function updatePaymentTerm(id: bigint, paymentTermId: number, request: NextRequest) {
  const existingClient = await prisma.clients.findUnique({ where: { id } });

  if (!existingClient || existingClient.deleted_at) {
    return null;
  }

  const updatedClient = await prisma.clients.update({
    where: { id },
    data: {
      payment_term_id: paymentTermId,
      updated_at: new Date(),
    },
    include: { payment_terms: true },
  });

  await logActivity({
    request,
    operation: OPERATIONS.CLIENT_UPDATE,
    description: `Condición de pago actualizada para cliente ${existingClient.business_name}`,
    entityType: 'client',
    entityId: id,
    details: {
      field: 'payment_term_id',
      oldValue: existingClient.payment_term_id,
      newValue: paymentTermId,
    },
  });

  return {
    paymentTermId: updatedClient.payment_term_id,
    paymentTermName: updatedClient.payment_terms?.name,
  };
}

export async function getClassification(
  config: Partial<ClientClassificationConfig>,
  forceRefresh: boolean,
  statusFilter?: ClientStatus
) {
  const cacheInfo = getClientClassificationCacheInfo();
  const classification = await calculateClientClassification(config, forceRefresh);

  if (statusFilter && classification.byStatus[statusFilter]) {
    return {
      status: statusFilter,
      ...classification.byStatus[statusFilter],
      config: classification.config,
      calculatedAt: classification.calculatedAt,
      cacheInfo,
    };
  }

  return { ...classification, cacheInfo };
}
