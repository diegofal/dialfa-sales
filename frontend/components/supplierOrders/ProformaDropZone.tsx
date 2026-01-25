'use client';

import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useImportProforma } from '@/lib/hooks/useImportProforma';
import { ImportResult } from '@/lib/utils/priceLists/proformaImport/types';

interface ProformaDropZoneProps {
  onImportSuccess: (result: ImportResult) => void;
}

export function ProformaDropZone({ onImportSuccess }: ProformaDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
      alert('Por favor seleccione un archivo Excel (.xls o .xlsx)');
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
              Archivos compatibles: .xls, .xlsx (máx. 5MB)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <Button onClick={handleBrowseClick} variant="outline">
            Seleccionar Archivo
          </Button>
        </div>
      </Card>

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
