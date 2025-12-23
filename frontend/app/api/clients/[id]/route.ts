import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapClientToDTO } from '@/lib/utils/mapper';
import { updateClientSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

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
      client_discounts: client.client_discounts.map((discount: typeof client.client_discounts[number]) => ({
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if client exists and is not deleted
    const existingClient = await prisma.clients.findUnique({
      where: { id },
    });

    if (!existingClient || existingClient.deleted_at) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = updateClientSchema.parse(body);

    // Convert camelCase to snake_case for Prisma
    const client = await prisma.clients.update({
      where: { id },
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
        is_active: validatedData.isActive,
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
      operation: OPERATIONS.CLIENT_UPDATE,
      description: `Cliente ${client.business_name} (${client.code}) actualizado`,
      entityType: 'client',
      entityId: id,
      details: { code: client.code, businessName: client.business_name }
    });

    return NextResponse.json(mappedClient);
  } catch (error) {
    console.error('Error updating client:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    // Check if client exists and is not already deleted
    const existingClient = await prisma.clients.findUnique({
      where: { id },
    });

    if (!existingClient || existingClient.deleted_at) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Soft delete: mark as deleted
    await prisma.clients.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CLIENT_DELETE,
      description: `Cliente ${existingClient.business_name} (${existingClient.code}) eliminado`,
      entityType: 'client',
      entityId: id,
      details: { code: existingClient.code, businessName: existingClient.business_name }
    });

    return NextResponse.json(
      { message: 'Client deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    );
  }
}

