import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateSalesOrderPermissions as calculatePermissions } from '@/types/permissions';
import type { SalesOrderStatus } from '@/types/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            is_printed: true,
            is_cancelled: true,
          },
          where: {
            deleted_at: null,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
        delivery_notes: {
          select: {
            id: true,
          },
          where: {
            deleted_at: null,
          },
          take: 1,
        },
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    const invoice = salesOrder.invoices[0];
    const deliveryNote = salesOrder.delivery_notes[0];

    const status: SalesOrderStatus = {
      id: Number(salesOrder.id),
      hasInvoice: !!invoice,
      invoicePrinted: invoice?.is_printed ?? false,
      invoiceCancelled: invoice?.is_cancelled ?? false,
      hasDeliveryNote: !!deliveryNote,
      hasUnsavedChanges: false, // This is handled client-side
    };

    const permissions = calculatePermissions(status);

    return NextResponse.json({
      status,
      permissions,
    });
  } catch (error) {
    console.error('Error fetching sales order permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales order permissions' },
      { status: 500 }
    );
  }
}


