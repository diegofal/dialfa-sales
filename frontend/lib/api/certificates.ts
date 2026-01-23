import type {
  CertificateResponse,
  ColadaResponse,
  CertificateSearchParams,
} from '@/types/certificate';
import { apiClient } from './client';

interface CertificatesResponse {
  data: CertificateResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ColadasResponse {
  data: ColadaResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UploadParams {
  file: File;
  coladas: string[];
  category: string;
  notes?: string;
}

export const certificatesApi = {
  /**
   * Get all certificates with optional filters
   */
  getAll: async (params: CertificateSearchParams = {}): Promise<CertificatesResponse> => {
    const { data } = await apiClient.get<CertificatesResponse>('/certificates', { params });
    return data;
  },

  /**
   * Get single certificate by ID with signed URL
   */
  getById: async (id: string): Promise<CertificateResponse & { signed_url: string }> => {
    const { data } = await apiClient.get<CertificateResponse & { signed_url: string }>(
      `/certificates/${id}`
    );
    return data;
  },

  /**
   * Get all coladas (batch numbers) with optional search
   */
  getColadas: async (search?: string): Promise<ColadasResponse> => {
    const params: Record<string, string> = { limit: '50' };
    if (search) params.search = search;

    const { data } = await apiClient.get<ColadasResponse>('/coladas', { params });
    return data;
  },

  /**
   * Upload a new certificate
   */
  upload: async (params: UploadParams): Promise<CertificateResponse> => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('coladas', JSON.stringify(params.coladas));
    formData.append('category', params.category);
    if (params.notes) formData.append('notes', params.notes);

    const { data } = await apiClient.post<CertificateResponse>('/certificates', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  /**
   * Delete a certificate
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/certificates/${id}`);
  },

  /**
   * Download certificate PDF
   */
  downloadPdf: async (id: string): Promise<void> => {
    const response = await apiClient.get(`/certificates/${id}/download`, {
      responseType: 'blob',
    });

    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `certificate-${id}.pdf`);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    window.URL.revokeObjectURL(url);
  },
};
