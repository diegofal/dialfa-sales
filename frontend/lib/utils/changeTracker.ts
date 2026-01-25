import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export type EntityKey =
  | 'sales_order'
  | 'invoice'
  | 'delivery_note'
  | 'client'
  | 'article'
  | 'category'
  | 'certificate'
  | 'user'
  | 'settings';

interface TrackedChange {
  entityType: EntityKey;
  entityId: bigint | number;
  entityLabel: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
}

interface EntityConfig {
  fetch: (id: bigint) => Promise<Record<string, unknown> | null>;
  getLabel: (state: Record<string, unknown>) => string;
}

/**
 * Registry of entity configurations for the ChangeTracker.
 * To add a new entity type: add the EntityKey type and register it here.
 */
const entityRegistry: Record<EntityKey, EntityConfig> = {
  sales_order: {
    fetch: (id) =>
      prisma.sales_orders.findUnique({
        where: { id },
        include: { clients: true, sales_order_items: { include: { articles: true } } },
      }),
    getLabel: (state) => `Pedido ${(state as { order_number?: string }).order_number || 'N/A'}`,
  },
  invoice: {
    fetch: (id) =>
      prisma.invoices.findUnique({
        where: { id },
        include: { sales_orders: { include: { clients: true } }, invoice_items: true },
      }),
    getLabel: (state) =>
      `Factura ${(state as { invoice_number?: string }).invoice_number || 'N/A'}`,
  },
  delivery_note: {
    fetch: (id) =>
      prisma.delivery_notes.findUnique({
        where: { id },
        include: { sales_orders: true, delivery_note_items: true },
      }),
    getLabel: (state) =>
      `Remito ${(state as { delivery_number?: string }).delivery_number || 'N/A'}`,
  },
  client: {
    fetch: (id) => prisma.clients.findUnique({ where: { id } }),
    getLabel: (state) => `Cliente ${(state as { business_name?: string }).business_name || 'N/A'}`,
  },
  article: {
    fetch: (id) => prisma.articles.findUnique({ where: { id }, include: { categories: true } }),
    getLabel: (state) => {
      const a = state as { code?: string; description?: string };
      return `Artículo ${a.code || 'N/A'} - ${a.description || 'N/A'}`;
    },
  },
  category: {
    fetch: (id) => prisma.categories.findUnique({ where: { id } }),
    getLabel: (state) => `Categoría ${(state as { name?: string }).name || 'N/A'}`,
  },
  certificate: {
    fetch: (id) =>
      prisma.certificates.findUnique({
        where: { id },
        include: { certificate_coladas: { include: { colada: true } } },
      }),
    getLabel: (state) => `Certificado ${(state as { file_name?: string }).file_name || 'N/A'}`,
  },
  user: {
    fetch: (id) => prisma.users.findUnique({ where: { id: Number(id) } }),
    getLabel: (state) => `Usuario ${(state as { username?: string }).username || 'N/A'}`,
  },
  settings: {
    fetch: (id) => prisma.system_settings.findUnique({ where: { id: Number(id) } }),
    getLabel: () => `Configuración del Sistema`,
  },
};

export class ChangeTracker {
  private changes: TrackedChange[] = [];

  /**
   * Captura el estado actual de una entidad antes de modificarla
   */
  async trackBefore(entityType: EntityKey, entityId: bigint | number): Promise<void> {
    const beforeState = await this.fetchEntityState(entityType, entityId);

    if (beforeState) {
      this.changes.push({
        entityType,
        entityId,
        entityLabel: this.generateLabel(entityType, beforeState),
        beforeState,
        afterState: null,
      });
    }
  }

  /**
   * Captura el estado después de la modificación
   */
  async trackAfter(entityType: EntityKey, entityId: bigint | number): Promise<void> {
    const afterState = await this.fetchEntityState(entityType, entityId);

    const change = this.changes.find(
      (c) => c.entityType === entityType && BigInt(c.entityId) === BigInt(entityId)
    );

    if (change) {
      change.afterState = afterState;
    }
  }

  /**
   * Registra una creación (sin estado anterior)
   */
  trackCreate(
    entityType: EntityKey,
    entityId: bigint | number,
    afterState: Record<string, unknown>
  ): void {
    this.changes.push({
      entityType,
      entityId,
      entityLabel: this.generateLabel(entityType, afterState),
      beforeState: null,
      afterState,
    });
  }

  /**
   * Registra una eliminación (sin estado posterior)
   */
  trackDelete(
    entityType: EntityKey,
    entityId: bigint | number,
    beforeState: Record<string, unknown>
  ): void {
    this.changes.push({
      entityType,
      entityId,
      entityLabel: this.generateLabel(entityType, beforeState),
      beforeState,
      afterState: null,
    });
  }

  /**
   * Guarda todos los cambios en la base de datos
   */
  async saveChanges(activityLogId: bigint): Promise<void> {
    if (this.changes.length === 0) return;

    await prisma.activity_changes.createMany({
      data: this.changes.map((change) => ({
        activity_log_id: activityLogId,
        entity_type: change.entityType,
        entity_id: BigInt(change.entityId),
        entity_label: change.entityLabel,
        before_state: (change.beforeState as Prisma.InputJsonValue) ?? undefined,
        after_state: (change.afterState as Prisma.InputJsonValue) ?? undefined,
      })),
    });

    this.changes = [];
  }

  private async fetchEntityState(
    entityType: EntityKey,
    entityId: bigint | number
  ): Promise<Record<string, unknown> | null> {
    const config = entityRegistry[entityType];
    if (!config) return null;
    return config.fetch(BigInt(entityId));
  }

  private generateLabel(entityType: EntityKey, state: Record<string, unknown> | null): string {
    if (!state) return `${entityType} (eliminado)`;
    const config = entityRegistry[entityType];
    if (!config) return entityType;
    return config.getLabel(state);
  }
}
