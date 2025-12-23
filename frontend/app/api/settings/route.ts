import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

// Validation schema for updating settings
const updateSettingsSchema = z.object({
  usdExchangeRate: z.number().positive('Exchange rate must be positive'),
});

// GET /api/settings - Get current system settings
export async function GET() {
  try {
    let settings = await prisma.system_settings.findUnique({
      where: { id: 1 },
    });

    // If settings don't exist, create with default values
    if (!settings) {
      settings = await prisma.system_settings.create({
        data: {
          id: 1,
          usd_exchange_rate: 1000.00,
          updated_at: new Date(),
        },
      });
    }

    return NextResponse.json({
      id: settings.id,
      usdExchangeRate: Number(settings.usd_exchange_rate),
      updatedAt: settings.updated_at.toISOString(),
      updatedBy: settings.updated_by,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update system settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = updateSettingsSchema.parse(body);

    // Update settings
    const settings = await prisma.system_settings.upsert({
      where: { id: 1 },
      update: {
        usd_exchange_rate: validatedData.usdExchangeRate,
        updated_at: new Date(),
        // TODO: Set updated_by from authenticated user session
      },
      create: {
        id: 1,
        usd_exchange_rate: validatedData.usdExchangeRate,
        updated_at: new Date(),
      },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.SETTINGS_UPDATE,
      description: `Cotización USD actualizada a ${validatedData.usdExchangeRate}`,
      entityType: 'settings',
      details: { usdExchangeRate: validatedData.usdExchangeRate }
    });

    return NextResponse.json({
      id: settings.id,
      usdExchangeRate: Number(settings.usd_exchange_rate),
      updatedAt: settings.updated_at.toISOString(),
      updatedBy: settings.updated_by,
    });
  } catch (error) {
    console.error('Error updating settings:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}





