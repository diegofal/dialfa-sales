import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const skip = (page - 1) * limit;

    // Filter parameters
    const articleId = searchParams.get('articleId');
    const movementType = searchParams.get('movementType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {
      deleted_at: null,
    };

    if (articleId) {
      where.article_id = BigInt(articleId);
    }

    if (movementType) {
      where.movement_type = parseInt(movementType);
    }

    if (startDate || endDate) {
      where.movement_date = {};
      if (startDate) {
        where.movement_date.gte = new Date(startDate);
      }
      if (endDate) {
        where.movement_date.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await prisma.stock_movements.count({ where });

    // Get stock movements
    const stockMovements = await prisma.stock_movements.findMany({
      where,
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
      skip,
      take: limit,
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

    return NextResponse.json({
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

