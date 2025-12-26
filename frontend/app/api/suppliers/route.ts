import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/roles';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const searchTerm = searchParams.get('searchTerm') || '';

    const where: Prisma.suppliersWhereInput = {};

    if (activeOnly) {
      where.is_active = true;
      where.deleted_at = null;
    }

    if (searchTerm) {
      where.OR = [
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.suppliers.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const dto = suppliers.map((s) => ({
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
    }));

    return NextResponse.json({
      success: true,
      data: dto,
      total: dto.length,
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Error al obtener proveedores' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, contactName, email, phone, address, notes, isActive } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Código y nombre son requeridos' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.suppliers.findFirst({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese código' },
        { status: 400 }
      );
    }

    const supplier = await prisma.suppliers.create({
      data: {
        code: code.toUpperCase(),
        name,
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        is_active: isActive ?? true,
        created_by: user.userId,
        updated_by: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        contactName: supplier.contact_name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        notes: supplier.notes,
        isActive: supplier.is_active,
        createdAt: supplier.created_at.toISOString(),
        updatedAt: supplier.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Error al crear proveedor' },
      { status: 500 }
    );
  }
}


