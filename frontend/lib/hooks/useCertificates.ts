import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { certificatesApi } from '@/lib/api/certificates';
import type { CertificateSearchParams } from '@/types/certificate';

// Hook to fetch certificates
export function useCertificates(params: CertificateSearchParams = {}) {
  return useQuery({
    queryKey: ['certificates', params],
    queryFn: () => certificatesApi.getAll(params),
  });
}

// Hook to fetch single certificate
export function useCertificate(id: string | null) {
  return useQuery({
    queryKey: ['certificate', id],
    queryFn: () => certificatesApi.getById(id!),
    enabled: !!id,
  });
}

// Hook to search coladas
export function useColadas(search?: string) {
  return useQuery({
    queryKey: ['coladas', search],
    queryFn: () => certificatesApi.getColadas(search),
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Hook to upload certificate
export function useUploadCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { file: File; coladas: string[]; category: string; notes?: string }) =>
      certificatesApi.upload(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['coladas'] });
      toast.success('Certificado subido exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al subir el certificado');
    },
  });
}

// Hook to delete certificate
export function useDeleteCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => certificatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Certificado eliminado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el certificado');
    },
  });
}

// Hook to download certificate PDF
export function useDownloadCertificatePdf() {
  return useMutation({
    mutationFn: (id: string) => certificatesApi.downloadPdf(id),
    onSuccess: () => {
      toast.success('Descargando certificado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al descargar el certificado');
    },
  });
}
