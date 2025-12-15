'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCertificate } from '@/lib/hooks/useCertificates';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TiffViewer } from './TiffViewer';

interface CertificateViewerDialogProps {
  certificateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertificateViewerDialog({ 
  certificateId, 
  open, 
  onOpenChange 
}: CertificateViewerDialogProps) {
  const { data: certificate, isLoading, error } = useCertificate(certificateId);
  const [previewError, setPreviewError] = useState(false);

  // Reset preview error when certificate changes
  useEffect(() => {
    setPreviewError(false);
  }, [certificateId]);

  const isPreviewable = certificate && ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp'].includes(
    certificate.file_type.toLowerCase()
  );
  
  const isTiff = certificate && ['tif', 'tiff'].includes(certificate.file_type.toLowerCase());

  const handleDownload = () => {
    if (certificate?.signed_url) {
      window.open(certificate.signed_url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {certificate?.file_name || 'Cargando...'}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <p>Error al cargar el certificado</p>
          </div>
        )}

        {certificate && (
          <div className="flex-1 overflow-auto">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Categoría</p>
                <Badge variant="secondary">{certificate.category || 'Sin categoría'}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{certificate.file_type.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha de carga</p>
                <p className="font-medium">
                  {format(new Date(certificate.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tamaño</p>
                <p className="font-medium">
                  {certificate.file_size_bytes 
                    ? `${(parseInt(certificate.file_size_bytes) / 1024).toFixed(1)} KB` 
                    : '-'}
                </p>
              </div>
            </div>

            {/* Coladas */}
            {certificate.coladas.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Coladas asociadas</p>
                <div className="flex flex-wrap gap-2">
                  {certificate.coladas.map((colada) => (
                    <Badge key={colada.id} variant="outline">
                      {colada.colada_number}
                      {colada.description && (
                        <span className="ml-1 text-muted-foreground">
                          - {colada.description}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Preview or Download */}
            {isPreviewable && !previewError ? (
              <div className="border rounded-lg overflow-hidden bg-muted/50">
                {certificate.file_type.toLowerCase() === 'pdf' ? (
                  <iframe
                    src={certificate.signed_url}
                    className="w-full h-[500px]"
                    title={certificate.file_name}
                    onError={() => setPreviewError(true)}
                  />
                ) : isTiff ? (
                  <div className="flex items-center justify-center p-4">
                    <TiffViewer
                      url={certificate.signed_url!}
                      alt={certificate.file_name}
                      className="max-w-full max-h-[500px] object-contain"
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4">
                    <img
                      src={certificate.signed_url}
                      alt={certificate.file_name}
                      className="max-w-full max-h-[500px] object-contain"
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 border rounded-lg bg-muted/50">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {previewError 
                    ? 'No se pudo mostrar la vista previa' 
                    : 'Vista previa no disponible para este tipo de archivo'}
                </p>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar archivo
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              <Button variant="outline" onClick={() => window.open(certificate.signed_url, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir en nueva pestaña
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


