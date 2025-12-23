import { NextRequest, NextResponse } from 'next/server';

export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export function getUserFromRequest(request: NextRequest) {
  return {
    userId: request.headers.get('x-user-id') ? parseInt(request.headers.get('x-user-id')!) : null,
    role: request.headers.get('x-user-role') as Role | null,
    email: request.headers.get('x-user-email'),
  };
}

export function requireAdmin(request: NextRequest) {
  const user = getUserFromRequest(request);
  
  // Normalize role to lowercase for comparison
  if (user.role?.toLowerCase() !== ROLES.ADMIN) {
    return {
      authorized: false,
      user,
      error: NextResponse.json(
        { error: 'Forbidden', message: 'Acceso solo para administradores' },
        { status: 403 }
      ),
    };
  }
  
  return { authorized: true, user, error: null };
}

