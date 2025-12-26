import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/roles';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const supplier = await prisma.suppliers.findUnique({
      where: { id },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

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
        deletedAt: supplier.deleted_at?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Error al obtener proveedor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    const { code, name, contactName, email, phone, address, notes, isActive } = body;

    // Check if supplier exists
    const existing = await prisma.suppliers.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    // Check if code is being changed and if it already exists
    if (code && code.toUpperCase() !== existing.code) {
      const codeExists = await prisma.suppliers.findFirst({
        where: { code: code.toUpperCase(), id: { not: id } },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: 'Ya existe un proveedor con ese código' },
          { status: 400 }
        );
      }
    }

    const supplier = await prisma.suppliers.update({
      where: { id },
      data: {
        code: code?.toUpperCase() || existing.code,
        name: name || existing.name,
        contact_name: contactName ?? existing.contact_name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        address: address ?? existing.address,
        notes: notes ?? existing.notes,
        is_active: isActive ?? existing.is_active,
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
        updatedAt: supplier.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Error al actualizar proveedor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);

    // Soft delete
    await prisma.suppliers.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_by: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Proveedor eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Error al eliminar proveedor' },
      { status: 500 }
    );
  }
}


