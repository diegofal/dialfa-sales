import { NextRequest, NextResponse } from 'next/server';

export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function getUserFromRequest(request: NextRequest) {
  return {
    userId: request.headers.get('x-user-id') ? parseInt(request.headers.get('x-user-id')!) : null,
    role: request.headers.get('x-user-role') as Role | null,
    email: request.headers.get('x-user-email'),
  };
}

export function requireAdmin(
  request: NextRequest
):
  | { authorized: true; user: ReturnType<typeof getUserFromRequest> }
  | { authorized: false; error: NextResponse } {
  const user = getUserFromRequest(request);

  // Normalize role to lowercase for comparison
  if (user.role?.toLowerCase() !== ROLES.ADMIN) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden', message: 'Acceso solo para administradores' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}

export function requireRoles(
  request: NextRequest,
  allowedRoles: Role[]
):
  | { authorized: true; user: ReturnType<typeof getUserFromRequest> }
  | { authorized: false; error: NextResponse } {
  const user = getUserFromRequest(request);
  const userRole = user.role?.toLowerCase();

  // Check if user role is in allowed roles
  const isAuthorized = allowedRoles.some((role) => role.toLowerCase() === userRole);

  if (!isAuthorized) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden', message: 'No tiene permisos para realizar esta acción' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}

export function requirePermission(
  request: NextRequest,
  resource: string,
  action: string
):
  | { authorized: true; user: ReturnType<typeof getUserFromRequest> }
  | { authorized: false; error: NextResponse } {
  // Import PERMISSIONS dynamically to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PERMISSIONS } = require('./permissions');

  const user = getUserFromRequest(request);
  const permission = PERMISSIONS[resource]?.[action];

  if (!permission) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden', message: `Permiso no definido para ${action} en ${resource}` },
        { status: 403 }
      ),
    };
  }

  // Check authentication requirement (any authenticated user)
  if (permission.requireAuthentication) {
    if (!user.userId) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Unauthorized', message: 'Debe iniciar sesión' },
          { status: 401 }
        ),
      };
    }
    return { authorized: true, user };
  }

  // Check public access (no authentication required)
  if (permission.roles.length === 0) {
    return { authorized: true, user };
  }

  // Check role-based access
  const userRole = user.role?.toLowerCase();
  const isAuthorized = permission.roles.some((role: Role) => role.toLowerCase() === userRole);

  if (!isAuthorized) {
    const rolesStr = permission.roles.join(', ');
    return {
      authorized: false,
      error: NextResponse.json(
        {
          error: 'Forbidden',
          message: `No tiene permisos para ${action} en ${resource}. Roles requeridos: ${rolesStr}`,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}
