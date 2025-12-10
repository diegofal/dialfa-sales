export interface StockMovement {
  id: number;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  movementType: number;
  movementTypeName: string;
  quantity: number;
  referenceDocument: string | null;
  movementDate: string;
  notes: string | null;
  createdAt: string;
}

export enum StockMovementType {
  PURCHASE = 1,
  SALE = 2,
  RETURN = 3,
  ADJUSTMENT = 4,
  TRANSFER = 5,
}

export const STOCK_MOVEMENT_TYPE_NAMES: Record<number, string> = {
  [StockMovementType.PURCHASE]: 'Compra',
  [StockMovementType.SALE]: 'Venta',
  [StockMovementType.RETURN]: 'Devolución',
  [StockMovementType.ADJUSTMENT]: 'Ajuste',
  [StockMovementType.TRANSFER]: 'Transferencia',
};













