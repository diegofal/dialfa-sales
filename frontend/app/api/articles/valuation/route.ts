import { NextRequest, NextResponse } from 'next/server';
import { calculateStockValuation, getStockValuationCacheInfo } from '@/lib/services/stockValuation';
import { StockStatus } from '@/types/stockValuation';
import { getUserFromRequest } from '@/lib/auth/roles';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Configuración personalizada
    const config = {
      activeThresholdDays: parseInt(searchParams.get('activeThreshold') || '90'),
      slowMovingThresholdDays: parseInt(searchParams.get('slowThreshold') || '180'),
      deadStockThresholdDays: parseInt(searchParams.get('deadThreshold') || '365'),
      minSalesForActive: parseInt(searchParams.get('minSales') || '5'),
      trendMonths: parseInt(searchParams.get('trendMonths') || '6'),
      includeZeroStock: searchParams.get('includeZeroStock') === 'true',
    };

    const forceRefresh = searchParams.get('refresh') === 'true';

    // Obtener info del caché antes de calcular
    const cacheInfo = getStockValuationCacheInfo();

    // Calcular valorización
    const valuation = await calculateStockValuation(config, forceRefresh);

    // Filtrar por status si se especifica
    const statusFilter = searchParams.get('status') as StockStatus | null;
    if (statusFilter && valuation.byStatus[statusFilter]) {
      return NextResponse.json({
        status: statusFilter,
        ...valuation.byStatus[statusFilter],
        config: valuation.config,
        calculatedAt: valuation.calculatedAt,
        cacheInfo,
      });
    }

    return NextResponse.json({
      ...valuation,
      cacheInfo,
    });
  } catch (error) {
    console.error('Error getting stock valuation:', error);
    return NextResponse.json(
      { error: 'Failed to get stock valuation' },
      { status: 500 }
    );
  }
}

// Endpoint para forzar refresh (solo admin)
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Solo administradores pueden refrescar el caché' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const valuation = await calculateStockValuation(body.config || {}, true);

    return NextResponse.json({
      message: 'Valorización recalculada exitosamente',
      valuation,
    });
  } catch (error) {
    console.error('Error refreshing stock valuation:', error);
    return NextResponse.json(
      { error: 'Failed to refresh stock valuation' },
      { status: 500 }
    );
  }
}

