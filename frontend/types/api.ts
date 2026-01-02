// API Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: string;
  };
  token: string;
}

export interface ClientDto {
  id: number;
  code: string;
  businessName: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  creditLimit: number | null;
  paymentTermId: number;
  taxConditionName: string | null;
  provinceName: string | null;
  operationTypeName: string | null;
  transporterName: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  salesTrend?: number[];
  salesTrendLabels?: string[];
  // Client classification
  clientStatus?: 'active' | 'slow_moving' | 'inactive' | 'never_purchased';
  daysSinceLastPurchase?: number | null;
  lastPurchaseDate?: string | null;
  rfmScore?: number;
}

export interface CreateClientRequest {
  code: string;
  businessName: string;
  cuit?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  provinceId?: number;
  phone?: string;
  email?: string;
  taxConditionId: number;
  operationTypeId: number;
  transporterId?: number;
  creditLimit?: number;
  paymentTermId?: number;
}

export interface UpdateClientRequest extends CreateClientRequest {
  id: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}


