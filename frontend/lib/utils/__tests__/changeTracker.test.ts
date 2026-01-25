import { ChangeTracker } from '../changeTracker';

// Mock prisma to avoid DB dependency
jest.mock('@/lib/db', () => ({
  prisma: {
    activity_changes: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    sales_orders: { findUnique: jest.fn().mockResolvedValue(null) },
    invoices: { findUnique: jest.fn().mockResolvedValue(null) },
    delivery_notes: { findUnique: jest.fn().mockResolvedValue(null) },
    clients: { findUnique: jest.fn().mockResolvedValue(null) },
    articles: { findUnique: jest.fn().mockResolvedValue(null) },
    categories: { findUnique: jest.fn().mockResolvedValue(null) },
    certificates: { findUnique: jest.fn().mockResolvedValue(null) },
    users: { findUnique: jest.fn().mockResolvedValue(null) },
    system_settings: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

describe('ChangeTracker', () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
    jest.clearAllMocks();
  });

  describe('trackCreate', () => {
    it('stores a creation with null beforeState', () => {
      const afterState = { order_number: 'PV-00100', status: 'PENDING' };
      tracker.trackCreate('sales_order', 1n, afterState);

      // Verify by saving and checking the call
      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'sales_order',
            entity_id: 1n,
            before_state: undefined,
            after_state: afterState,
          }),
        ]),
      });
    });

    it('generates label for sales_order from order_number', () => {
      const afterState = { order_number: 'PV-00200' };
      tracker.trackCreate('sales_order', 2n, afterState);

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Pedido PV-00200',
          }),
        ]),
      });
    });

    it('generates label for invoice from invoice_number', () => {
      tracker.trackCreate('invoice', 5n, { invoice_number: 'FC-A-00001' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Factura FC-A-00001',
          }),
        ]),
      });
    });

    it('generates label for delivery_note from delivery_number', () => {
      tracker.trackCreate('delivery_note', 10n, { delivery_number: 'R-00050' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Remito R-00050',
          }),
        ]),
      });
    });

    it('generates label for client from business_name', () => {
      tracker.trackCreate('client', 3n, { business_name: 'Acme Corp' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Cliente Acme Corp',
          }),
        ]),
      });
    });

    it('generates label for article from code and description', () => {
      tracker.trackCreate('article', 42n, { code: 'ART-001', description: 'Brida Ciega' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Artículo ART-001 - Brida Ciega',
          }),
        ]),
      });
    });

    it('generates label for category from name', () => {
      tracker.trackCreate('category', 7n, { name: 'Bridas' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Categoría Bridas',
          }),
        ]),
      });
    });

    it('generates label for certificate from file_name', () => {
      tracker.trackCreate('certificate', 1n, { file_name: 'cert-2024.pdf' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Certificado cert-2024.pdf',
          }),
        ]),
      });
    });

    it('generates label for user from username', () => {
      tracker.trackCreate('user', 1n, { username: 'admin' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Usuario admin',
          }),
        ]),
      });
    });

    it('generates label for settings as "Configuración del Sistema"', () => {
      tracker.trackCreate('settings', 1n, { key: 'company_name', value: 'Spisa' });

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Configuración del Sistema',
          }),
        ]),
      });
    });

    it('uses N/A for missing label fields', () => {
      tracker.trackCreate('sales_order', 1n, { status: 'PENDING' }); // No order_number

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_label: 'Pedido N/A',
          }),
        ]),
      });
    });
  });

  describe('trackDelete', () => {
    it('stores a deletion with null afterState', () => {
      const beforeState = { order_number: 'PV-00100', status: 'PENDING' };
      tracker.trackDelete('sales_order', 1n, beforeState);

      const { prisma } = require('@/lib/db');
      tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'sales_order',
            before_state: beforeState,
            after_state: undefined,
          }),
        ]),
      });
    });
  });

  describe('trackBefore / trackAfter', () => {
    it('trackBefore does nothing when entity is not found', async () => {
      const { prisma } = require('@/lib/db');
      prisma.clients.findUnique.mockResolvedValue(null);

      await tracker.trackBefore('client', 999n);
      await tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).not.toHaveBeenCalled();
    });

    it('trackBefore stores state from database', async () => {
      const { prisma } = require('@/lib/db');
      const clientState = { id: 10n, business_name: 'Test Corp', code: 'CLI-010' };
      prisma.clients.findUnique.mockResolvedValue(clientState);

      await tracker.trackBefore('client', 10n);
      await tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'client',
            entity_id: 10n,
            before_state: clientState,
            after_state: undefined,
          }),
        ]),
      });
    });

    it('trackAfter updates the afterState of a pending change', async () => {
      const { prisma } = require('@/lib/db');
      const beforeState = { id: 10n, business_name: 'Old Name', code: 'CLI-010' };
      const afterState = { id: 10n, business_name: 'New Name', code: 'CLI-010' };

      prisma.clients.findUnique
        .mockResolvedValueOnce(beforeState)
        .mockResolvedValueOnce(afterState);

      await tracker.trackBefore('client', 10n);
      await tracker.trackAfter('client', 10n);
      await tracker.saveChanges(1n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            before_state: beforeState,
            after_state: afterState,
          }),
        ]),
      });
    });
  });

  describe('saveChanges', () => {
    it('does nothing when no changes are tracked', async () => {
      const { prisma } = require('@/lib/db');
      await tracker.saveChanges(1n);
      expect(prisma.activity_changes.createMany).not.toHaveBeenCalled();
    });

    it('clears changes after saving', async () => {
      const { prisma } = require('@/lib/db');
      tracker.trackCreate('article', 1n, { code: 'ART-001', description: 'Test' });
      await tracker.saveChanges(1n);

      // Second save should not call createMany again
      prisma.activity_changes.createMany.mockClear();
      await tracker.saveChanges(2n);
      expect(prisma.activity_changes.createMany).not.toHaveBeenCalled();
    });

    it('saves multiple changes in one batch', async () => {
      const { prisma } = require('@/lib/db');
      tracker.trackCreate('article', 1n, { code: 'ART-001', description: 'First' });
      tracker.trackCreate('article', 2n, { code: 'ART-002', description: 'Second' });
      tracker.trackDelete('client', 5n, { business_name: 'Deleted Corp' });

      await tracker.saveChanges(100n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ entity_id: 1n }),
          expect.objectContaining({ entity_id: 2n }),
          expect.objectContaining({ entity_id: 5n }),
        ]),
      });
      expect(prisma.activity_changes.createMany.mock.calls[0][0].data).toHaveLength(3);
    });

    it('passes the activityLogId to each change record', async () => {
      const { prisma } = require('@/lib/db');
      tracker.trackCreate('category', 1n, { name: 'Test' });
      await tracker.saveChanges(42n);

      expect(prisma.activity_changes.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ activity_log_id: 42n })]),
      });
    });
  });
});
