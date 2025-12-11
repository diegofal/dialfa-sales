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
  taxConditionId: number;
  taxConditionName: string | null;
  provinceId: number | null;
  provinceName: string | null;
  operationTypeId: number;
  operationTypeName: string | null;
  transporterId: number | null;
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
}

export interface UpdateClientRequest extends CreateClientRequest {
  id: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}


