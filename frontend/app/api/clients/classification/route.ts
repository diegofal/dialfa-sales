import { NextRequest, NextResponse } from 'next/server';
import { calculateClientClassification, getClientClassificationCacheInfo } from '@/lib/services/clientClassification';
import { ClientStatus } from '@/types/clientClassification';
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
      inactiveThresholdDays: parseInt(searchParams.get('inactiveThreshold') || '365'),
      minPurchasesForActive: parseInt(searchParams.get('minPurchases') || '3'),
      trendMonths: parseInt(searchParams.get('trendMonths') || '12'),
    };

    const forceRefresh = searchParams.get('refresh') === 'true';

    // Obtener info del caché antes de calcular
    const cacheInfo = getClientClassificationCacheInfo();

    // Calcular clasificación
    const classification = await calculateClientClassification(config, forceRefresh);

    // Filtrar por status si se especifica
    const statusFilter = searchParams.get('status') as ClientStatus | null;
    if (statusFilter && classification.byStatus[statusFilter]) {
      return NextResponse.json({
        status: statusFilter,
        ...classification.byStatus[statusFilter],
        config: classification.config,
        calculatedAt: classification.calculatedAt,
        cacheInfo,
      });
    }

    return NextResponse.json({
      ...classification,
      cacheInfo,
    });
  } catch (error) {
    console.error('Error getting client classification:', error);
    return NextResponse.json(
      { error: 'Failed to get client classification' },
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
    const classification = await calculateClientClassification(body.config || {}, true);

    return NextResponse.json({
      message: 'Clasificación recalculada exitosamente',
      classification,
    });
  } catch (error) {
    console.error('Error refreshing client classification:', error);
    return NextResponse.json(
      { error: 'Failed to refresh client classification' },
      { status: 500 }
    );
  }
}

