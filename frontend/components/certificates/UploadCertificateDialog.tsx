'use client';

import { Upload, X, FileUp } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUploadCertificate } from '@/lib/hooks/useCertificates';
import { CERTIFICATE_CATEGORIES } from '@/types/certificate';

interface UploadCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadCertificateDialog({ open, onOpenChange }: UploadCertificateDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('');
  const [coladaInput, setColadaInput] = useState('');
  const [coladas, setColadas] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadCertificate();

  const handleFileSelect = (selectedFile: File) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/tiff',
      'image/bmp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    // Also check extension for tif files which may not have correct MIME type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = [
      'pdf',
      'jpg',
      'jpeg',
      'png',
      'gif',
      'tif',
      'tiff',
      'bmp',
      'xls',
      'xlsx',
      'doc',
      'docx',
    ];

    if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(ext || '')) {
      toast.error('Tipo de archivo no permitido');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const addColada = () => {
    const trimmed = coladaInput.trim().toUpperCase();
    if (trimmed && !coladas.includes(trimmed)) {
      setColadas([...coladas, trimmed]);
      setColadaInput('');
    }
  };

  const removeColada = (colada: string) => {
    setColadas(coladas.filter((c) => c !== colada));
  };

  const handleColadaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addColada();
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecciona un archivo');
      return;
    }
    if (!category) {
      toast.error('Selecciona una categoría');
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        file,
        category,
        coladas,
        notes: notes || undefined,
      });

      toast.success('Certificado subido correctamente');
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir el certificado');
    }
  };

  const resetForm = () => {
    setFile(null);
    setCategory('');
    setColadas([]);
    setColadaInput('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Subir Certificado</DialogTitle>
          <DialogDescription>
            Sube un certificado de calidad y asócialo a números de colada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* File Drop Zone */}
          <div
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'} ${file ? 'bg-muted' : 'hover:border-primary/50'} `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.tif,.tiff,.bmp,.xls,.xlsx,.doc,.docx"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileUp className="text-primary h-5 w-5" />
                  <span className="max-w-[300px] truncate font-medium">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="text-muted-foreground mx-auto mb-2 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  Arrastra un archivo aquí o haz clic para seleccionar
                </p>
                <p className="text-muted-foreground mt-1 text-xs">PDF, imágenes, Excel, Word</p>
              </>
            )}
          </div>

          {/* Category */}
          <div className="grid gap-2">
            <Label htmlFor="category">Categoría *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {CERTIFICATE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Coladas */}
          <div className="grid gap-2">
            <Label htmlFor="coladas">Números de Colada</Label>
            <div className="flex gap-2">
              <Input
                id="coladas"
                placeholder="Ej: 011U07GI"
                value={coladaInput}
                onChange={(e) => setColadaInput(e.target.value)}
                onKeyDown={handleColadaKeyDown}
              />
              <Button type="button" variant="secondary" onClick={addColada}>
                Agregar
              </Button>
            </div>
            {coladas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {coladas.map((colada) => (
                  <Badge key={colada} variant="secondary" className="gap-1">
                    {colada}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeColada(colada)} />
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Presiona Enter o coma para agregar múltiples coladas
            </p>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales sobre el certificado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Subiendo...' : 'Subir Certificado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
