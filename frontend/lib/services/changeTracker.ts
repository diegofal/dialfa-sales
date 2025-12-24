import { prisma } from '@/lib/db';

type EntityKey = 'sales_order' | 'invoice' | 'delivery_note' | 'client' | 
                 'article' | 'category' | 'certificate' | 'user';

interface TrackedChange {
  entityType: EntityKey;
  entityId: bigint | number;
  entityLabel: string;
  beforeState: any;
  afterState: any;
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
    afterState: any
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
    beforeState: any
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
        before_state: change.beforeState,
        after_state: change.afterState,
      })),
    });
    
    this.changes = [];
  }
  
  private async fetchEntityState(
    entityType: EntityKey,
    entityId: bigint | number
  ): Promise<any> {
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
      
      default:
        return null;
    }
  }
  
  private generateLabel(entityType: EntityKey, state: any): string {
    if (!state) return `${entityType} (eliminado)`;
    
    switch (entityType) {
      case 'sales_order':
        return `Pedido ${state.order_number}`;
      case 'invoice':
        return `Factura ${state.invoice_number}`;
      case 'delivery_note':
        return `Remito ${state.delivery_number}`;
      case 'client':
        return `Cliente ${state.business_name}`;
      case 'article':
        return `Artículo ${state.code} - ${state.description}`;
      case 'category':
        return `Categoría ${state.name}`;
      case 'certificate':
        return `Certificado ${state.file_name}`;
      case 'user':
        return `Usuario ${state.username}`;
      default:
        return entityType;
    }
  }
}

