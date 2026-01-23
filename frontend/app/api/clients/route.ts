import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ClientService from '@/lib/services/ClientService';
import { createClientSchema } from '@/lib/validations/schemas';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await ClientService.list({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      search: searchParams.get('search') || '',
      includeTrends: searchParams.get('includeTrends') === 'true',
      includeClassification: searchParams.get('includeClassification') === 'true',
      trendMonths: parseInt(searchParams.get('trendMonths') || '12'),
      classificationStatus: searchParams.get('classificationStatus') || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createClientSchema.parse(body);
    const client = await ClientService.create(validatedData, request);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
