'use client';

import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SyncExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface SyncStats {
  totalInExcel: number;
  newUploaded: number;
  coladasUpdated: number;
  alreadyExisted: number;
  fileNotFound: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

export function SyncExcelDialog({ open, onOpenChange, onComplete }: SyncExcelDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar que sea un archivo Excel
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (
        !validTypes.includes(selectedFile.type) &&
        !selectedFile.name.endsWith('.xls') &&
        !selectedFile.name.endsWith('.xlsx')
      ) {
        toast.error('Por favor selecciona un archivo Excel (.xls o .xlsx)');
        return;
      }

      setFile(selectedFile);
      setStats(null);
    }
  };

  const handleSync = async () => {
    if (!file) return;

    setIsUploading(true);
    setStats(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/certificates/sync', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la sincronización');
      }

      const result = await response.json();
      setStats(result.stats);

      if (result.stats.newUploaded > 0 || result.stats.coladasUpdated > 0) {
        toast.success('Sincronización completada');
        onComplete?.();
      } else {
        toast.info('No hay cambios para sincronizar');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al sincronizar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setStats(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Sincronizar desde Excel
          </DialogTitle>
          <DialogDescription>
            Sube el archivo Excel de certificados para sincronizar con la base de datos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          {!stats && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <FileSpreadsheet className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <div className="space-y-2">
                  <label htmlFor="excel-file" className="cursor-pointer">
                    <div className="text-sm font-medium">
                      {file ? file.name : 'Seleccionar archivo Excel'}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">Formatos: .xls, .xlsx</div>
                  </label>
                  <input
                    id="excel-file"
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                {!file && (
                  <Button
                    onClick={() => document.getElementById('excel-file')?.click()}
                    variant="outline"
                    className="mt-4"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Seleccionar archivo
                  </Button>
                )}
              </div>

              {file && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-muted-foreground text-sm">
                        {(file.size / 1024).toFixed(2)} KB
                      </div>
                    </div>
                    <Button onClick={() => setFile(null)} variant="ghost" size="sm">
                      Cambiar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-2xl font-bold">{stats.totalInExcel}</div>
                  <div className="text-muted-foreground text-sm">Total en Excel</div>
                </div>
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600">{stats.newUploaded}</div>
                  <div className="text-muted-foreground text-sm">Nuevos subidos</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                  <div className="text-2xl font-bold text-blue-600">{stats.coladasUpdated}</div>
                  <div className="text-muted-foreground text-sm">Coladas actualizadas</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                  <div className="text-2xl font-bold">{stats.alreadyExisted}</div>
                  <div className="text-muted-foreground text-sm">Sin cambios</div>
                </div>
              </div>

              {(stats.fileNotFound > 0 || stats.failed > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    Archivos con problemas
                  </div>
                  <div className="space-y-2 rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                    {stats.fileNotFound > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">{stats.fileNotFound}</span> no encontrados en
                        sistema
                      </div>
                    )}
                    {stats.failed > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">{stats.failed}</span> fallidos
                      </div>
                    )}
                  </div>

                  {stats.errors.length > 0 && (
                    <div className="bg-muted max-h-40 space-y-1 overflow-y-auto rounded p-3 text-xs">
                      {stats.errors.slice(0, 10).map((err, i) => (
                        <div key={i} className="flex gap-2">
                          <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500" />
                          <div>
                            <div className="font-medium">{err.file}</div>
                            <div className="text-muted-foreground">{err.error}</div>
                          </div>
                        </div>
                      ))}
                      {stats.errors.length > 10 && (
                        <div className="text-muted-foreground italic">
                          ... y {stats.errors.length - 10} más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              {stats ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!stats && (
              <Button onClick={handleSync} disabled={!file || isUploading}>
                {isUploading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Sincronizar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
