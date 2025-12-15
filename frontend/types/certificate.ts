// Certificate types for the certificates module

export interface Certificate {
  id: bigint
  file_name: string
  storage_path: string
  original_path: string | null
  file_type: string
  file_size_bytes: bigint | null
  category: string | null
  notes: string | null
  extracted_text: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  created_by: number | null
  certificate_coladas?: CertificateColada[]
}

export interface Colada {
  id: bigint
  colada_number: string
  description: string | null
  supplier: string | null
  material_type: string | null
  created_at: Date
  updated_at: Date
  certificate_coladas?: CertificateColada[]
}

export interface CertificateColada {
  id: bigint
  certificate_id: bigint
  colada_id: bigint
  created_at: Date
  certificate?: Certificate
  colada?: Colada
}

// API response types (with serialized bigints)
export interface CertificateResponse {
  id: string
  file_name: string
  storage_path: string
  original_path: string | null
  file_type: string
  file_size_bytes: string | null
  category: string | null
  notes: string | null
  created_at: string
  updated_at: string
  coladas: ColadaResponse[]
  signed_url?: string
}

export interface ColadaResponse {
  id: string
  colada_number: string
  description: string | null
  supplier: string | null
  material_type: string | null
  created_at: string
  updated_at: string
  certificates_count?: number
}

// Search/filter params
export interface CertificateSearchParams {
  colada?: string
  category?: string
  file_type?: string
  page?: number
  limit?: number
}

// Upload request
export interface CertificateUploadRequest {
  file: File
  coladas: string[] // Colada numbers
  category: string
  notes?: string
}

// Category options for certificates
export const CERTIFICATE_CATEGORIES = [
  'ACCESORIOS',
  'BRIDAS',
  'ESPARRAGOS',
  'FORJADO'
] as const

export type CertificateCategory = typeof CERTIFICATE_CATEGORIES[number]


