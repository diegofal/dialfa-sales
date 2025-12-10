import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoiceId = BigInt(id);

    // First, get the invoice to verify it exists
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        invoice_items: {
          select: {
            article_id: true,
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Get the article IDs from the invoice items
    const articleIds = invoice.invoice_items.map((item) => item.article_id);

    // Get stock movements for these articles that reference this invoice
    const stockMovements = await prisma.stock_movements.findMany({
      where: {
        AND: [
          {
            deleted_at: null,
          },
          {
            OR: [
              // Movements that reference this invoice (using contains because reference_document has format "Impresión factura {number}")
              {
                reference_document: {
                  contains: invoice.invoice_number,
                },
              },
              // Movements for the articles in this invoice
              {
                article_id: {
                  in: articleIds,
                },
                reference_document: {
                  contains: invoice.invoice_number,
                },
              },
            ],
          },
        ],
      },
      include: {
        articles: {
          select: {
            code: true,
            description: true,
          },
        },
      },
      orderBy: {
        movement_date: 'desc',
      },
    });

    // Transform the data
    const movements = stockMovements.map((movement) => ({
      id: Number(movement.id),
      articleId: Number(movement.article_id),
      articleCode: movement.articles.code,
      articleDescription: movement.articles.description,
      movementType: movement.movement_type,
      movementTypeName: getMovementTypeName(movement.movement_type),
      quantity: movement.quantity,
      referenceDocument: movement.reference_document,
      movementDate: movement.movement_date.toISOString(),
      notes: movement.notes,
      createdAt: movement.created_at.toISOString(),
    }));

    return NextResponse.json(movements);
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock movements' },
      { status: 500 }
    );
  }
}

function getMovementTypeName(type: number): string {
  const typeNames: Record<number, string> = {
    1: 'Compra',
    2: 'Venta',
    3: 'Devolución',
    4: 'Ajuste',
    5: 'Transferencia',
  };
  
  return typeNames[type] || 'Otro';
}










