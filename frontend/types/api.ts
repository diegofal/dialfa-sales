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
  currentBalance: number;
  isActive: boolean;
  paymentTermId: number;
  paymentTermName: string | null;
  taxConditionName: string | null;
  provinceName: string | null;
  operationTypeName: string | null;
  transporterName: string | null;
  createdAt: string;
  updatedAt: string;
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
  currentBalance?: number;
  paymentTermId: number;
}

export interface UpdateClientRequest extends CreateClientRequest {
  id: number;
  isActive: boolean;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}


