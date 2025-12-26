import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CertificateResponse, ColadaResponse, CertificateSearchParams } from '@/types/certificate'

interface CertificatesResponse {
  data: CertificateResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ColadasResponse {
  data: ColadaResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Fetch certificates with optional filters
async function fetchCertificates(params: CertificateSearchParams): Promise<CertificatesResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.colada) searchParams.set('colada', params.colada)
  if (params.category) searchParams.set('category', params.category)
  if (params.file_type) searchParams.set('file_type', params.file_type)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())

  const response = await fetch(`/api/certificates?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch certificates')
  }
  return response.json()
}

// Fetch single certificate with signed URL
async function fetchCertificate(id: string): Promise<CertificateResponse & { signed_url: string }> {
  const response = await fetch(`/api/certificates/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch certificate')
  }
  return response.json()
}

// Fetch coladas
async function fetchColadas(search?: string): Promise<ColadasResponse> {
  const searchParams = new URLSearchParams()
  if (search) searchParams.set('search', search)
  searchParams.set('limit', '50')

  const response = await fetch(`/api/coladas?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch coladas')
  }
  return response.json()
}

// Upload certificate
interface UploadParams {
  file: File
  coladas: string[]
  category: string
  notes?: string
}

async function uploadCertificate(params: UploadParams): Promise<CertificateResponse> {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('coladas', JSON.stringify(params.coladas))
  formData.append('category', params.category)
  if (params.notes) formData.append('notes', params.notes)

  const response = await fetch('/api/certificates', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload certificate')
  }
  return response.json()
}

// Delete certificate
async function deleteCertificate(id: string): Promise<void> {
  const response = await fetch(`/api/certificates/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete certificate')
  }
}

// Hook to fetch certificates
export function useCertificates(params: CertificateSearchParams = {}) {
  return useQuery({
    queryKey: ['certificates', params],
    queryFn: () => fetchCertificates(params)
  })
}

// Hook to fetch single certificate
export function useCertificate(id: string | null) {
  return useQuery({
    queryKey: ['certificate', id],
    queryFn: () => fetchCertificate(id!),
    enabled: !!id
  })
}

// Hook to search coladas
export function useColadas(search?: string) {
  return useQuery({
    queryKey: ['coladas', search],
    queryFn: () => fetchColadas(search),
    staleTime: 30000 // Cache for 30 seconds
  })
}

// Hook to upload certificate
export function useUploadCertificate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
      queryClient.invalidateQueries({ queryKey: ['coladas'] })
    }
  })
}

// Hook to delete certificate
export function useDeleteCertificate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
    }
  })
}






