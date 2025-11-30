export interface DeliveryNoteItem {
  id: number;
  salesOrderItemId: number | null;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  createdAt: string;
}

export interface DeliveryNote {
  id: number;
  deliveryNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  clientBusinessName: string;
  deliveryDate: string;
  transporterId: number | null;
  transporterName: string | null;
  transporterAddress: string | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: DeliveryNoteItem[];
}

export interface DeliveryNoteListDto {
  id: number;
  deliveryNumber: string;
  deliveryDate: string;
  salesOrderId: number;
  salesOrderNumber: string;
  clientBusinessName: string;
  transporterName: string | null;
  packagesCount: number | null;
  itemsCount: number;
}

export interface DeliveryNoteItemRequest {
  salesOrderItemId: number | null;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
}

export interface CreateDeliveryNoteRequest {
  salesOrderId: number;
  deliveryDate: string;
  transporterId: number | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
  items: DeliveryNoteItemRequest[];
}

export interface UpdateDeliveryNoteRequest {
  deliveryDate: string;
  transporterId: number | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
}



