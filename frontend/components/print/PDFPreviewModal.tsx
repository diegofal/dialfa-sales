import { Loader2, Printer, Download, X } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  isLoading: boolean;
  onPrint: () => void;
  title?: string;
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  previewUrl,
  isLoading,
  onPrint,
  title = 'Vista Previa del Documento',
}: PDFPreviewModalProps) {
  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full flex-1 overflow-hidden rounded-md bg-gray-100">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
            </div>
          ) : previewUrl ? (
            <iframe src={previewUrl} className="h-full w-full border-none" title="PDF Preview" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              No hay vista previa disponible
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cerrar
          </Button>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={!previewUrl || isLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
            <Button onClick={onPrint} disabled={!previewUrl || isLoading}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
