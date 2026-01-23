'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCertificate } from '@/lib/hooks/useCertificates';
import { TiffViewer } from './TiffViewer';

interface CertificateViewerDialogProps {
  certificateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertificateViewerDialog({
  certificateId,
  open,
  onOpenChange,
}: CertificateViewerDialogProps) {
  const { data: certificate, isLoading, error } = useCertificate(certificateId);
  const [previewError, setPreviewError] = useState(false);

  // Reset preview error when certificate changes
  useEffect(() => {
    setPreviewError(false);
  }, [certificateId]);

  const isPreviewable =
    certificate &&
    ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp'].includes(
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
      <DialogContent size="xl" className="flex max-h-[90vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {certificate?.file_name || 'Cargando...'}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-destructive flex flex-col items-center justify-center py-20">
            <p>Error al cargar el certificado</p>
          </div>
        )}

        {certificate && (
          <div className="flex-1 overflow-auto">
            {/* Metadata */}
            <div className="bg-muted mb-4 grid grid-cols-2 gap-4 rounded-lg p-4">
              <div>
                <p className="text-muted-foreground text-sm">Categoría</p>
                <Badge variant="secondary">{certificate.category || 'Sin categoría'}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Tipo</p>
                <p className="font-medium">{certificate.file_type.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Fecha de carga</p>
                <p className="font-medium">
                  {format(new Date(certificate.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Tamaño</p>
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
                <p className="text-muted-foreground mb-2 text-sm">Coladas asociadas</p>
                <div className="flex flex-wrap gap-2">
                  {certificate.coladas.map((colada) => (
                    <Badge key={colada.id} variant="outline">
                      {colada.colada_number}
                      {colada.description && (
                        <span className="text-muted-foreground ml-1">- {colada.description}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Preview or Download */}
            {isPreviewable && !previewError ? (
              <div className="bg-muted/50 overflow-hidden rounded-lg border">
                {certificate.file_type.toLowerCase() === 'pdf' ? (
                  <iframe
                    src={certificate.signed_url}
                    className="h-[500px] w-full"
                    title={certificate.file_name}
                    onError={() => setPreviewError(true)}
                  />
                ) : isTiff ? (
                  <div className="flex items-center justify-center p-4">
                    <TiffViewer
                      url={certificate.signed_url!}
                      alt={certificate.file_name}
                      className="max-h-[500px] max-w-full object-contain"
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4">
                    <img
                      src={certificate.signed_url}
                      alt={certificate.file_name}
                      className="max-h-[500px] max-w-full object-contain"
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted/50 flex flex-col items-center justify-center rounded-lg border py-10">
                <FileText className="text-muted-foreground mb-4 h-16 w-16" />
                <p className="text-muted-foreground mb-4">
                  {previewError
                    ? 'No se pudo mostrar la vista previa'
                    : 'Vista previa no disponible para este tipo de archivo'}
                </p>
                <Button onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar archivo
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(certificate.signed_url, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir en nueva pestaña
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
