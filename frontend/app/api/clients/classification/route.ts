import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ClientService from '@/lib/services/ClientService';
import { ClientStatus } from '@/types/clientClassification';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const config = {
      activeThresholdDays: parseInt(searchParams.get('activeThreshold') || '90'),
      slowMovingThresholdDays: parseInt(searchParams.get('slowThreshold') || '180'),
      inactiveThresholdDays: parseInt(searchParams.get('inactiveThreshold') || '365'),
      minPurchasesPerMonth: parseInt(searchParams.get('minPurchasesPerMonth') || '1'),
      trendMonths: parseInt(searchParams.get('trendMonths') || '12'),
    };
    const forceRefresh = searchParams.get('refresh') === 'true';
    const statusFilter = searchParams.get('status') as ClientStatus | undefined;

    const result = await ClientService.getClassification(
      config,
      forceRefresh,
      statusFilter || undefined
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.CLIENTS, ACTIONS.CLASSIFICATION);
    if (!auth.authorized) return auth.error;

    const body = await request.json();
    const result = await ClientService.getClassification(body.config || {}, true);
    return NextResponse.json({
      message: 'Clasificación recalculada exitosamente',
      classification: result,
    });
  } catch (error) {
    return handleError(error);
  }
}
