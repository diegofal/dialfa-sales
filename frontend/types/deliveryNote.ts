export interface DeliveryNote {
  id: number;
  deliveryNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  clientBusinessName: string;
  deliveryDate: string;
  transporterId: number | null;
  transporterName: string | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryNoteListDto {
  id: number;
  deliveryNumber: string;
  deliveryDate: string;
  salesOrderNumber: string;
  clientBusinessName: string;
  transporterName: string | null;
  packagesCount: number | null;
}

export interface CreateDeliveryNoteRequest {
  salesOrderId: number;
  deliveryDate: string;
  transporterId: number | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
}

export interface UpdateDeliveryNoteRequest {
  deliveryDate: string;
  transporterId: number | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
}

