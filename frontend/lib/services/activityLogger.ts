import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

interface LogActivityParams {
  request: NextRequest;
  operation: string;
  description: string;
  entityType?: string;
  entityId?: bigint | number;
  details?: Record<string, unknown>;
  username?: string; // Add optional username override
}

/**
 * Logs a business operation to the activity_logs table.
 * Does not throw errors to avoid breaking the main operation.
 * Returns the ID of the created activity log for tracking changes.
 */
export async function logActivity(params: LogActivityParams): Promise<bigint | null> {
  try {
    const userIdStr = params.request.headers.get('x-user-id');
    const headerUsername = params.request.headers.get('x-user-name');
    
    // Priority: 1. Manual override, 2. Header from middleware, 3. 'unknown'
    const username = params.username || headerUsername || 'unknown';
    
    const userId = userIdStr ? parseInt(userIdStr) : null;

    const ipAddress = params.request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      params.request.headers.get('x-real-ip') || 
                      null;

    const log = await prisma.activity_logs.create({
      data: {
        user_id: userId,
        username,
        operation: params.operation,
        description: params.description,
        entity_type: params.entityType || null,
        entity_id: params.entityId ? BigInt(params.entityId) : null,
        details: (params.details as Prisma.InputJsonValue) ?? undefined,
        ip_address: ipAddress,
      },
    });
    
    return log.id;
  } catch (error) {
    console.error('Failed to log activity:', error);
    return null;
  }
}

