import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettingsToDTO(settings: any) {
  return {
    id: settings.id,
    usdExchangeRate: Number(settings.usd_exchange_rate),
    updatedAt: settings.updated_at.toISOString(),
    updatedBy: settings.updated_by,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function get() {
  let settings = await prisma.system_settings.findUnique({ where: { id: 1 } });

  if (!settings) {
    settings = await prisma.system_settings.create({
      data: { id: 1, usd_exchange_rate: 1000.0, updated_at: new Date() },
    });
  }

  return mapSettingsToDTO(settings);
}

export async function update(data: { usdExchangeRate: number }, request: NextRequest) {
  const tracker = new ChangeTracker();

  const existingSettings = await prisma.system_settings.findUnique({ where: { id: 1 } });

  if (existingSettings) {
    await tracker.trackBefore('settings', 1);
  }

  const settings = await prisma.system_settings.upsert({
    where: { id: 1 },
    update: {
      usd_exchange_rate: data.usdExchangeRate,
      updated_at: new Date(),
    },
    create: {
      id: 1,
      usd_exchange_rate: data.usdExchangeRate,
      updated_at: new Date(),
    },
  });

  if (existingSettings) {
    await tracker.trackAfter('settings', 1);
  } else {
    tracker.trackCreate('settings', 1, settings as unknown as Record<string, unknown>);
  }

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.SETTINGS_UPDATE,
    description: `Cotización USD actualizada a ${data.usdExchangeRate}`,
    entityType: 'settings',
    entityId: 1,
    details: { usdExchangeRate: data.usdExchangeRate },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapSettingsToDTO(settings);
}
