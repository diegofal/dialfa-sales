'use server';

import { getErrorMessage } from '@/lib/utils/errors';

import { prisma } from '@/lib/db';
import { createClientSchema, updateClientSchema, type CreateClientInput, type UpdateClientInput } from '@/lib/validations/schemas';
import { revalidatePath } from 'next/cache';

export async function createClient(data: CreateClientInput) {
  try {
    const validated = createClientSchema.parse(data);

    // Check if code already exists
    const existing = await prisma.clients.findFirst({
      where: {
        code: validated.code,
        deleted_at: null,
      },
    });

    if (existing) {
      return {
        success: false,
        error: 'Ya existe un cliente con este código',
      };
    }

    const client = await prisma.clients.create({
      data: {
        code: validated.code,
        business_name: validated.businessName,
        cuit: validated.cuit,
        tax_condition_id: validated.taxConditionId,
        address: validated.address,
        city: validated.city,
        postal_code: validated.postalCode,
        province_id: validated.provinceId,
        phone: validated.phone,
        email: validated.email || null,
        operation_type_id: validated.operationTypeId,
        transporter_id: validated.transporterId,
        seller_id: validated.sellerId,
        credit_limit: validated.creditLimit,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/clients');

    return {
      success: true,
      data: {
        ...client,
        id: client.id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error creating client:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to create client',
    };
  }
}

export async function updateClient(id: string, data: UpdateClientInput) {
  try {
    const clientId = BigInt(id);
    const validated = updateClientSchema.parse(data);

    const existing = await prisma.clients.findUnique({
      where: { id: clientId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Cliente no encontrado',
      };
    }

    if (validated.code && validated.code !== existing.code) {
      const codeExists = await prisma.clients.findFirst({
        where: {
          code: validated.code,
          deleted_at: null,
          id: { not: clientId },
        },
      });

      if (codeExists) {
        return {
          success: false,
          error: 'Ya existe un cliente con este código',
        };
      }
    }

    const client = await prisma.clients.update({
      where: { id: clientId },
      data: {
        ...validated,
        business_name: validated.businessName,
        tax_condition_id: validated.taxConditionId,
        postal_code: validated.postalCode,
        province_id: validated.provinceId,
        operation_type_id: validated.operationTypeId,
        transporter_id: validated.transporterId,
        seller_id: validated.sellerId,
        credit_limit: validated.creditLimit,
        email: validated.email || null,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/clients');
    revalidatePath(`/dashboard/clients/${id}`);

    return {
      success: true,
      data: {
        ...client,
        id: client.id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error updating client:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to update client',
    };
  }
}

export async function deleteClient(id: string) {
  try {
    const clientId = BigInt(id);

    const existing = await prisma.clients.findUnique({
      where: { id: clientId },
      include: {
        sales_orders: {
          where: { deleted_at: null },
          take: 1,
        },
      },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Cliente no encontrado',
      };
    }

    if (existing.sales_orders.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un cliente que tiene pedidos asociados',
      };
    }

    await prisma.clients.update({
      where: { id: clientId },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/clients');

    return {
      success: true,
      message: 'Cliente eliminado correctamente',
    };
  } catch (error: unknown) {
    console.error('Error deleting client:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to delete client',
    };
  }
}


