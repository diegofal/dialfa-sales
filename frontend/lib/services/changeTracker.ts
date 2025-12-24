import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

type EntityKey = 'sales_order' | 'invoice' | 'delivery_note' | 'client' | 
                 'article' | 'category' | 'certificate' | 'user' | 'settings';

interface TrackedChange {
  entityType: EntityKey;
  entityId: bigint | number;
  entityLabel: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
}

export class ChangeTracker {
  private changes: TrackedChange[] = [];
  
  /**
   * Captura el estado actual de una entidad antes de modificarla
   */
  async trackBefore(
    entityType: EntityKey,
    entityId: bigint | number
  ): Promise<void> {
    const beforeState = await this.fetchEntityState(entityType, entityId);
    
    if (beforeState) {
      this.changes.push({
        entityType,
        entityId,
        entityLabel: this.generateLabel(entityType, beforeState),
        beforeState,
        afterState: null, // Se llenará después
      });
    }
  }
  
  /**
   * Captura el estado después de la modificación
   */
  async trackAfter(
    entityType: EntityKey,
    entityId: bigint | number
  ): Promise<void> {
    const afterState = await this.fetchEntityState(entityType, entityId);
    
    // Buscar el cambio pendiente
    const change = this.changes.find(
      c => c.entityType === entityType && 
           BigInt(c.entityId) === BigInt(entityId)
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
      data: this.changes.map(change => ({
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
    const id = BigInt(entityId);
    
    switch (entityType) {
      case 'sales_order':
        return await prisma.sales_orders.findUnique({
          where: { id },
          include: { clients: true, sales_order_items: { include: { articles: true } } }
        });
      
      case 'invoice':
        return await prisma.invoices.findUnique({
          where: { id },
          include: { sales_orders: { include: { clients: true } }, invoice_items: true }
        });
      
      case 'delivery_note':
        return await prisma.delivery_notes.findUnique({
          where: { id },
          include: { sales_orders: true, delivery_note_items: true }
        });
      
      case 'client':
        return await prisma.clients.findUnique({ where: { id } });
      
      case 'article':
        return await prisma.articles.findUnique({
          where: { id },
          include: { categories: true }
        });
      
      case 'category':
        return await prisma.categories.findUnique({ where: { id } });
      
      case 'certificate':
        return await prisma.certificates.findUnique({
          where: { id },
          include: { certificate_coladas: { include: { colada: true } } }
        });
      
      case 'user':
        return await prisma.users.findUnique({ where: { id: Number(id) } });
      
      case 'settings':
        return await prisma.system_settings.findUnique({ where: { id: Number(id) } });
      
      default:
        return null;
    }
  }
  
  private generateLabel(entityType: EntityKey, state: Record<string, unknown> | null): string {
    if (!state) return `${entityType} (eliminado)`;
    
    switch (entityType) {
      case 'sales_order':
        return `Pedido ${(state as { order_number?: string }).order_number || 'N/A'}`;
      case 'invoice':
        return `Factura ${(state as { invoice_number?: string }).invoice_number || 'N/A'}`;
      case 'delivery_note':
        return `Remito ${(state as { delivery_number?: string }).delivery_number || 'N/A'}`;
      case 'client':
        return `Cliente ${(state as { business_name?: string }).business_name || 'N/A'}`;
      case 'article':
        return `Artículo ${(state as { code?: string; description?: string }).code || 'N/A'} - ${(state as { description?: string }).description || 'N/A'}`;
      case 'category':
        return `Categoría ${(state as { name?: string }).name || 'N/A'}`;
      case 'certificate':
        return `Certificado ${(state as { file_name?: string }).file_name || 'N/A'}`;
      case 'user':
        return `Usuario ${(state as { username?: string }).username || 'N/A'}`;
      case 'settings':
        return `Configuración del Sistema`;
      default:
        return entityType;
    }
  }
}

