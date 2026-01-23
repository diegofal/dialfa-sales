import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma, Prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupplierListParams {
  activeOnly?: boolean;
  searchTerm?: string;
}

export interface CreateSupplierData {
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateSupplierData {
  code?: string;
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupplierToDTO(s: any) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    contactName: s.contact_name,
    email: s.email,
    phone: s.phone,
    address: s.address,
    notes: s.notes,
    isActive: s.is_active,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
    deletedAt: s.deleted_at?.toISOString() || null,
    createdBy: s.created_by,
    updatedBy: s.updated_by,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: SupplierListParams) {
  const where: Prisma.suppliersWhereInput = {};

  if (params.activeOnly) {
    where.is_active = true;
    where.deleted_at = null;
  }

  if (params.searchTerm) {
    where.OR = [
      { code: { contains: params.searchTerm, mode: 'insensitive' } },
      { name: { contains: params.searchTerm, mode: 'insensitive' } },
    ];
  }

  const suppliers = await prisma.suppliers.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  return suppliers.map(mapSupplierToDTO);
}

export async function getById(id: number) {
  const supplier = await prisma.suppliers.findUnique({ where: { id } });

  if (!supplier) {
    return null;
  }

  return mapSupplierToDTO(supplier);
}

export async function create(data: CreateSupplierData, userId: number, request: NextRequest) {
  const existing = await prisma.suppliers.findFirst({
    where: { code: data.code.toUpperCase() },
  });

  if (existing) {
    return { error: 'Ya existe un proveedor con ese código', status: 400 };
  }

  const supplier = await prisma.suppliers.create({
    data: {
      code: data.code.toUpperCase(),
      name: data.name,
      contact_name: data.contactName || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
      is_active: data.isActive ?? true,
      created_by: userId,
      updated_by: userId,
    },
  });

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_CREATE,
    description: `Proveedor ${supplier.name} (${supplier.code}) creado`,
    entityType: 'supplier',
    entityId: supplier.id,
    details: { code: supplier.code, name: supplier.name },
  });

  return { data: mapSupplierToDTO(supplier), status: 201 };
}

export async function update(
  id: number,
  data: UpdateSupplierData,
  userId: number,
  request: NextRequest
) {
  const existing = await prisma.suppliers.findUnique({ where: { id } });

  if (!existing) {
    return null;
  }

  if (data.code && data.code.toUpperCase() !== existing.code) {
    const codeExists = await prisma.suppliers.findFirst({
      where: { code: data.code.toUpperCase(), id: { not: id } },
    });

    if (codeExists) {
      return { error: 'Ya existe un proveedor con ese código', status: 400 };
    }
  }

  const supplier = await prisma.suppliers.update({
    where: { id },
    data: {
      code: data.code?.toUpperCase() || existing.code,
      name: data.name || existing.name,
      contact_name: data.contactName ?? existing.contact_name,
      email: data.email ?? existing.email,
      phone: data.phone ?? existing.phone,
      address: data.address ?? existing.address,
      notes: data.notes ?? existing.notes,
      is_active: data.isActive ?? existing.is_active,
      updated_by: userId,
    },
  });

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_UPDATE,
    description: `Proveedor ${supplier.name} (${supplier.code}) actualizado`,
    entityType: 'supplier',
    entityId: supplier.id,
    details: { code: supplier.code, name: supplier.name },
  });

  return { data: mapSupplierToDTO(supplier), status: 200 };
}

export async function remove(id: number, userId: number, request: NextRequest) {
  const supplier = await prisma.suppliers.findUnique({ where: { id } });

  if (!supplier) {
    return null;
  }

  await prisma.suppliers.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false, updated_by: userId },
  });

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_DELETE,
    description: `Proveedor ${supplier.name} (${supplier.code}) eliminado`,
    entityType: 'supplier',
    entityId: supplier.id,
    details: { code: supplier.code, name: supplier.name },
  });

  return true;
}
