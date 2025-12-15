'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CertificatesTable } from '@/components/certificates/CertificatesTable';
import { UploadCertificateDialog } from '@/components/certificates/UploadCertificateDialog';
import { CertificateViewerDialog } from '@/components/certificates/CertificateViewerDialog';
import { SyncExcelDialog } from '@/components/certificates/SyncExcelDialog';
import { useCertificates, useDeleteCertificate } from '@/lib/hooks/useCertificates';
import { CERTIFICATE_CATEGORIES, CertificateResponse } from '@/types/certificate';
import { Upload, Search, X, FileCheck, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export default function CertificatesPage() {
  // Search/filter state
  const [coladaSearch, setColadaSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedCertificateId, setSelectedCertificateId] = useState<string | null>(null);

  // Fetch certificates
  const { data, isLoading, refetch } = useCertificates({
    colada: coladaSearch || undefined,
    category: categoryFilter || undefined,
    page,
    limit: 20,
  });

  const deleteMutation = useDeleteCertificate();

  const handleView = (certificate: CertificateResponse) => {
    setSelectedCertificateId(certificate.id);
    setViewerOpen(true);
  };

  const handleDownload = async (certificate: CertificateResponse) => {
    try {
      toast.loading('Descargando archivo...', { id: 'download' });
      
      // Get signed URL
      const response = await fetch(`/api/certificates/${certificate.id}/download`);
      if (!response.ok) throw new Error('Error obteniendo URL de descarga');
      
      const { signedUrl } = await response.json();
      
      // Download file
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = certificate.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Archivo descargado', { id: 'download' });
    } catch (error) {
      toast.error('Error al descargar el archivo', { id: 'download' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Certificado eliminado');
    } catch {
      toast.error('Error al eliminar el certificado');
    }
  };

  const clearFilters = () => {
    setColadaSearch('');
    setCategoryFilter('');
    setPage(1);
  };

  const hasFilters = coladaSearch || categoryFilter;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Certificados de Calidad</h1>
            <p className="text-muted-foreground">
              Gestiona los certificados de calidad y búscalos por número de colada
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSyncDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Sincronizar Excel
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Subir Certificado
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número de colada..."
              value={coladaSearch}
              onChange={(e) => {
                setColadaSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>

        <Select 
          value={categoryFilter || "ALL"} 
          onValueChange={(value) => {
            setCategoryFilter(value === "ALL" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las categorías</SelectItem>
            {CERTIFICATE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Results info */}
      {data && (
        <div className="text-sm text-muted-foreground">
          Mostrando {data.data.length} de {data.pagination.total} certificados
          {hasFilters && ' (filtrado)'}
        </div>
      )}

      {/* Table */}
      <CertificatesTable
        certificates={data?.data || []}
        isLoading={isLoading}
        onView={handleView}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <UploadCertificateDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      <SyncExcelDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onComplete={() => refetch()}
      />

      <CertificateViewerDialog
        certificateId={selectedCertificateId}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}

