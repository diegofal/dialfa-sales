import { NextRequest, NextResponse } from 'next/server';
import { refreshABCClassification, getABCCacheInfo } from '@/lib/services/abcClassification';
import { getUserFromRequest } from '@/lib/auth/roles';

/**
 * POST /api/articles/abc-refresh
 * Fuerza el recálculo de la clasificación ABC
 * Solo accesible por administradores
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar que solo admin pueda refrescar
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Solo los administradores pueden refrescar la clasificación ABC' 
        },
        { status: 403 }
      );
    }

    const beforeInfo = getABCCacheInfo();
    
    console.log('ABC Refresh requested by:', user.email || `User ID: ${user.userId}`);
    await refreshABCClassification();
    
    const afterInfo = getABCCacheInfo();

    return NextResponse.json({
      success: true,
      message: 'Clasificación ABC actualizada correctamente',
      before: beforeInfo,
      after: afterInfo,
    });
  } catch (error) {
    console.error('Error refreshing ABC classification:', error);
    return NextResponse.json(
      { 
        error: 'Failed to refresh ABC classification',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/articles/abc-refresh
 * Obtiene información sobre el estado del caché ABC
 */
export async function GET() {
  try {
    const info = getABCCacheInfo();
    return NextResponse.json({
      success: true,
      cache: info,
    });
  } catch (error) {
    console.error('Error getting ABC cache info:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get ABC cache info',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

