import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleError } from '@/lib/errors';
import * as SettingsService from '@/lib/services/SettingsService';

const updateSettingsSchema = z.object({
  usdExchangeRate: z.number().positive('Exchange rate must be positive'),
});

export async function GET() {
  try {
    const settings = await SettingsService.get();
    return NextResponse.json(settings);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);
    const settings = await SettingsService.update(validatedData, request);

    return NextResponse.json(settings);
  } catch (error) {
    return handleError(error);
  }
}
