import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export interface LogActivityParams {
  request: NextRequest;
  operation: string;
  description: string;
  entityType?: string;
  entityId?: bigint | number;
  details?: Record<string, unknown>;
  username?: string;
}

export interface IActivityLogger {
  logActivity(params: LogActivityParams): Promise<bigint | null>;
}

/**
 * Extracts user info and IP from the request headers set by middleware.
 */
function extractRequestContext(request: NextRequest) {
  const userIdStr = request.headers.get('x-user-id');
  const headerUsername = request.headers.get('x-user-name');
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    null;

  return {
    userId: userIdStr ? parseInt(userIdStr) : null,
    username: headerUsername || 'unknown',
    ipAddress,
  };
}

/**
 * Logs a business operation to the activity_logs table.
 * Does not throw errors to avoid breaking the main operation.
 * Returns the ID of the created activity log for tracking changes.
 */
export async function logActivity(params: LogActivityParams): Promise<bigint | null> {
  try {
    const context = extractRequestContext(params.request);
    const username = params.username || context.username;

    const log = await prisma.activity_logs.create({
      data: {
        user_id: context.userId,
        username,
        operation: params.operation,
        description: params.description,
        entity_type: params.entityType || null,
        entity_id: params.entityId ? BigInt(params.entityId) : null,
        details: (params.details as Prisma.InputJsonValue) ?? undefined,
        ip_address: context.ipAddress,
      },
    });

    return log.id;
  } catch {
    // Activity logging should never break the main operation
    return null;
  }
}
