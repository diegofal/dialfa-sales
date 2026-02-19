import { ROLES, Role } from './roles';

// ============================================================================
// RESOURCES & ACTIONS CONSTANTS
// ============================================================================

export const RESOURCES = {
  ARTICLES: 'articles',
  CLIENTS: 'clients',
  SALES_ORDERS: 'sales-orders',
  INVOICES: 'invoices',
  DELIVERY_NOTES: 'delivery-notes',
  CERTIFICATES: 'certificates',
  SUPPLIERS: 'suppliers',
  CATEGORIES: 'categories',
  PRICE_LISTS: 'price-lists',
  STOCK_MOVEMENTS: 'stock-movements',
  ACTIVITY_LOGS: 'activity-logs',
  FEEDBACK: 'feedback',
  PURCHASE_ORDERS: 'purchase-orders',
  PROFORMA: 'proforma',
  CASH_RECEIPTS: 'cash-receipts',
  REMINDERS: 'reminders',
  INVOICING: 'invoicing',
  PENDING_DELIVERY: 'pending-delivery',
  COMMISSION_REPORTS: 'commission-reports',
} as const;

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  // Special actions
  ABC_REFRESH: 'abc-refresh',
  VALUATION: 'valuation',
  BULK_UPDATE: 'bulk-update',
  REVERT: 'revert',
  REVERT_BATCH: 'revert-batch',
  UNDO: 'undo',
  ADJUST: 'adjust',
  CLASSIFICATION: 'classification',
  CHANGES: 'changes',
  IMPORT_PROFORMA: 'import-proforma',
  GENERATE_REMINDERS: 'generate-reminders',
  PENDING_INVOICES: 'pending-invoices',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

// ============================================================================
// PERMISSION RULES
// ============================================================================

interface PermissionRule {
  roles: Role[];
  description?: string;
  requireAuthentication?: boolean; // If true, any authenticated user can access
}

// ============================================================================
// CENTRALIZED PERMISSIONS OBJECT
// This is the single source of truth for all permissions in the application
// ============================================================================

export const PERMISSIONS: Record<Resource, Partial<Record<Action, PermissionRule>>> = {
  // ARTICLES
  [RESOURCES.ARTICLES]: {
    [ACTIONS.LIST]: { roles: [], description: 'List all articles' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read article details' }, // Public
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create articles' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update articles' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete articles' },
    [ACTIONS.ABC_REFRESH]: { roles: [ROLES.ADMIN], description: 'Refresh ABC classification' },
    [ACTIONS.VALUATION]: { roles: [ROLES.ADMIN], description: 'Recalculate stock valuation' },
  },

  // CLIENTS
  [RESOURCES.CLIENTS]: {
    [ACTIONS.LIST]: { roles: [], description: 'List clients' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read client details' }, // Public
    [ACTIONS.CREATE]: {
      roles: [ROLES.ADMIN, ROLES.VENDEDOR],
      description: 'Create clients',
    },
    [ACTIONS.UPDATE]: {
      roles: [ROLES.ADMIN, ROLES.VENDEDOR],
      description: 'Update clients',
    },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete clients' },
    [ACTIONS.CLASSIFICATION]: {
      roles: [ROLES.ADMIN],
      description: 'Update client classification',
    },
  },

  // SALES ORDERS
  [RESOURCES.SALES_ORDERS]: {
    [ACTIONS.LIST]: { roles: [], description: 'List sales orders' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read sales order details' }, // Public
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN, ROLES.VENDEDOR], description: 'Create sales orders' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN, ROLES.VENDEDOR], description: 'Update sales orders' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete sales orders' },
  },

  // INVOICES
  [RESOURCES.INVOICES]: {
    [ACTIONS.LIST]: { roles: [], description: 'List invoices' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read invoice details' }, // Public
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN, ROLES.VENDEDOR], description: 'Create invoices' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update invoices' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete invoices' },
  },

  // DELIVERY NOTES
  [RESOURCES.DELIVERY_NOTES]: {
    [ACTIONS.LIST]: { roles: [], description: 'List delivery notes' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read delivery note details' }, // Public
    [ACTIONS.CREATE]: {
      roles: [ROLES.ADMIN, ROLES.VENDEDOR],
      description: 'Create delivery notes',
    },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update delivery notes' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete delivery notes' },
  },

  // CERTIFICATES
  [RESOURCES.CERTIFICATES]: {
    [ACTIONS.LIST]: { roles: [], description: 'List certificates' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read certificate details' }, // Public
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create certificates' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update certificates' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete certificates' },
  },

  // SUPPLIERS
  [RESOURCES.SUPPLIERS]: {
    [ACTIONS.LIST]: { requireAuthentication: true, roles: [], description: 'List suppliers' },
    [ACTIONS.READ]: {
      requireAuthentication: true,
      roles: [],
      description: 'Read supplier details',
    },
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create suppliers' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update suppliers' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete suppliers' },
  },

  // CATEGORIES
  [RESOURCES.CATEGORIES]: {
    [ACTIONS.LIST]: { roles: [], description: 'List categories' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read category details' }, // Public
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create categories' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update categories' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete categories' },
  },

  // PRICE LISTS
  [RESOURCES.PRICE_LISTS]: {
    [ACTIONS.LIST]: { roles: [], description: 'List price lists' }, // Public
    [ACTIONS.READ]: { roles: [], description: 'Read price list details' }, // Public
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create price lists' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update price lists' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete price lists' },
    [ACTIONS.BULK_UPDATE]: { roles: [ROLES.ADMIN], description: 'Bulk update price lists' },
    [ACTIONS.REVERT]: { roles: [ROLES.ADMIN], description: 'Revert price list changes' },
    [ACTIONS.REVERT_BATCH]: { roles: [ROLES.ADMIN], description: 'Revert batch price changes' },
    [ACTIONS.UNDO]: { roles: [ROLES.ADMIN], description: 'Undo price list changes' },
  },

  // STOCK MOVEMENTS
  [RESOURCES.STOCK_MOVEMENTS]: {
    [ACTIONS.LIST]: { roles: [ROLES.ADMIN], description: 'List stock movements' },
    [ACTIONS.READ]: { roles: [ROLES.ADMIN], description: 'Read stock movement details' },
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create stock movements' },
    [ACTIONS.ADJUST]: { roles: [ROLES.ADMIN, ROLES.VENDEDOR], description: 'Adjust stock levels' },
  },

  // ACTIVITY LOGS
  [RESOURCES.ACTIVITY_LOGS]: {
    [ACTIONS.LIST]: { roles: [ROLES.ADMIN], description: 'List activity logs' },
    [ACTIONS.READ]: { roles: [ROLES.ADMIN], description: 'Read activity log details' },
    [ACTIONS.CHANGES]: { roles: [ROLES.ADMIN], description: 'View activity log changes' },
  },

  // FEEDBACK
  [RESOURCES.FEEDBACK]: {
    [ACTIONS.LIST]: { roles: [ROLES.ADMIN], description: 'List feedback' },
    [ACTIONS.READ]: { roles: [ROLES.ADMIN], description: 'Read feedback details' },
    [ACTIONS.CREATE]: { requireAuthentication: true, roles: [], description: 'Create feedback' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update feedback' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete feedback' },
  },

  // PURCHASE ORDERS
  [RESOURCES.PURCHASE_ORDERS]: {
    [ACTIONS.LIST]: { roles: [ROLES.ADMIN], description: 'List purchase orders' },
    [ACTIONS.READ]: { roles: [ROLES.ADMIN], description: 'Read purchase order details' },
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create purchase orders' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update purchase orders' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete purchase orders' },
  },

  // PROFORMA
  [RESOURCES.PROFORMA]: {
    [ACTIONS.IMPORT_PROFORMA]: { roles: [ROLES.ADMIN], description: 'Import proforma' },
  },

  // CASH RECEIPTS
  [RESOURCES.CASH_RECEIPTS]: {
    [ACTIONS.LIST]: { roles: [ROLES.ADMIN], description: 'List cash receipts' },
    [ACTIONS.READ]: { roles: [ROLES.ADMIN], description: 'Read cash receipt details' },
    [ACTIONS.CREATE]: { roles: [ROLES.ADMIN], description: 'Create cash receipts' },
    [ACTIONS.UPDATE]: { roles: [ROLES.ADMIN], description: 'Update cash receipts' },
    [ACTIONS.DELETE]: { roles: [ROLES.ADMIN], description: 'Delete cash receipts' },
  },

  // REMINDERS
  [RESOURCES.REMINDERS]: {
    [ACTIONS.GENERATE_REMINDERS]: {
      roles: [ROLES.ADMIN],
      description: 'Generate payment reminders',
    },
  },

  // INVOICING
  [RESOURCES.INVOICING]: {
    [ACTIONS.PENDING_INVOICES]: {
      roles: [ROLES.ADMIN, ROLES.VENDEDOR],
      description: 'View pending invoices',
    },
  },

  // PENDING DELIVERY
  [RESOURCES.PENDING_DELIVERY]: {
    [ACTIONS.LIST]: {
      roles: [ROLES.ADMIN, ROLES.VENDEDOR],
      description: 'List pending deliveries',
    },
  },

  // COMMISSION REPORTS
  [RESOURCES.COMMISSION_REPORTS]: {
    [ACTIONS.LIST]: { roles: [ROLES.ADMIN], description: 'List commission reports' },
    [ACTIONS.READ]: { roles: [ROLES.ADMIN], description: 'Read commission report details' },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a user has permission to perform an action on a resource
 * @param resource - The resource being accessed
 * @param action - The action being performed
 * @param userRole - The user's role
 * @returns true if the user has permission, false otherwise
 */
export function hasPermission(resource: Resource, action: Action, userRole: Role | null): boolean {
  const permission = PERMISSIONS[resource]?.[action];
  if (!permission) return false;

  // Check authentication requirement (any authenticated user)
  if (permission.requireAuthentication) {
    return userRole !== null;
  }

  // Check public access (no authentication required)
  if (permission.roles.length === 0) {
    return true;
  }

  // Check role-based access
  if (!userRole) return false;
  return permission.roles.some((role) => role.toLowerCase() === userRole.toLowerCase());
}

// ============================================================================
// FRONTEND HOOKS (for React components)
// ============================================================================

/**
 * React hook for checking permissions in components
 * Note: This requires the auth store to be set up
 * @param resource - The resource being accessed
 * @param action - The action being performed
 * @returns true if the current user has permission
 */
export function usePermission(resource: Resource, action: Action): boolean {
  // This will be implemented when integrated with the auth store
  // For now, return a placeholder
  if (typeof window === 'undefined') return false;

  // You'll need to import and use your auth store here
  // Example: const { user } = useAuthStore();
  // return hasPermission(resource, action, user?.role as Role | null);

  // Placeholder implementation - will be completed in integration phase
  // TODO: Integrate with auth store
  void resource;
  void action;
  return false;
}

/**
 * React hook for checking multiple permissions at once
 * @param checks - Array of resource/action pairs to check
 * @returns Object with permission results keyed by "resource:action"
 */
export function usePermissions(
  checks: Array<{ resource: Resource; action: Action }>
): Record<string, boolean> {
  // This will be implemented when integrated with the auth store
  // For now, return a placeholder
  if (typeof window === 'undefined') return {};

  // Example implementation:
  // const { user } = useAuthStore();
  // const userRole = user?.role as Role | null;
  // return checks.reduce((acc, check) => {
  //   const key = `${check.resource}:${check.action}`;
  //   acc[key] = hasPermission(check.resource, check.action, userRole);
  //   return acc;
  // }, {} as Record<string, boolean>);

  // Placeholder implementation - will be completed in integration phase
  // TODO: Integrate with auth store
  void checks;
  return {};
}
