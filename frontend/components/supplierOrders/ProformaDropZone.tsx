'use client';

import { Upload, FileSpreadsheet, X, Info } from 'lucide-react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useImportProforma } from '@/lib/hooks/domain/useImportProforma';
import { ImportResult } from '@/lib/utils/priceLists/proformaImport/types';

const CSV_EXAMPLE = `description,size,quantity,unit_price,total_price,unit_weight,item_number
ELBOW 90 S3000 SW,1/2",1500,0.83,1245,0.2,7
TEE S2000 BSPT,3/4",500,1.33,665,0.39,20
CAP NPT,3/4",200,0.67,134,0.19,40
Stud bolt A193-B7,1/2"X2-3/4",3000,0.09,270,0.069,52`;

interface ProformaDropZoneProps {
  onImportSuccess: (result: ImportResult) => void;
}

export function ProformaDropZone({ onImportSuccess }: ProformaDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCsvFormat, setShowCsvFormat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportProforma();

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xls') && !name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      alert('Por favor seleccione un archivo Excel (.xls, .xlsx) o CSV (.csv)');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('El archivo excede el límite de 5MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      const result = await importMutation.mutateAsync(selectedFile);
      if (result.success) {
        onImportSuccess(result.data);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      // Error is handled by the mutation
      console.error('Import error:', error);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className={`rounded-full p-4 ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
            <Upload
              className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Importar Proforma</h3>
            <p className="text-muted-foreground text-sm">
              Arrastra un archivo Excel aquí o haz clic para seleccionar
            </p>
            <p className="text-muted-foreground text-xs">
              Archivos compatibles: .xls, .xlsx, .csv (máx. 5MB)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <Button onClick={handleBrowseClick} variant="outline">
            Seleccionar Archivo
          </Button>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => setShowCsvFormat(!showCsvFormat)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
        {showCsvFormat ? 'Ocultar formato CSV' : 'Ver formato CSV esperado'}
      </button>

      {showCsvFormat && (
        <Card className="bg-muted/50 space-y-3 p-4">
          <div className="space-y-1">
            <p className="text-xs font-medium">Nombre del archivo:</p>
            <code className="bg-background block rounded px-2 py-1 text-xs">
              Proveedor_NumProforma_YYYY-MM-DD.csv
            </code>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">
              Columnas requeridas:{' '}
              <span className="text-muted-foreground font-normal">
                description, size, quantity, unit_price
              </span>
            </p>
            <p className="text-xs font-medium">
              Columnas opcionales:{' '}
              <span className="text-muted-foreground font-normal">
                total_price, unit_weight, item_number
              </span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Ejemplo:</p>
            <pre className="bg-background overflow-x-auto rounded p-2 text-[10px] leading-relaxed">
              {CSV_EXAMPLE}
            </pre>
          </div>
          <p className="text-muted-foreground text-[10px]">
            El campo &quot;description&quot; debe incluir tipo + serie + conexion (ej: ELBOW 90
            S3000 SW) para el matching automático con artículos.
          </p>
        </Card>
      )}

      {selectedFile && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                <p className="text-muted-foreground text-xs">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleImport} disabled={importMutation.isPending} size="sm">
                {importMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
              <Button
                onClick={handleClear}
                disabled={importMutation.isPending}
                variant="ghost"
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
