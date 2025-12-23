import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth/jwt';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

export async function POST(request: NextRequest) {
  // Log activity BEFORE clearing cookie so we have the user context
  // Also pass the username from the request header if available
  await logActivity({
    request,
    operation: OPERATIONS.LOGOUT,
    description: `Usuario cerró sesión`,
    entityType: 'user',
    username: request.headers.get('x-user-name') || undefined,
  });

  await clearAuthCookie();
  return NextResponse.json({ message: 'Logged out successfully' });
}
