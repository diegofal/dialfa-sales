'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Trash2, Download, FileText, FileImage, FileSpreadsheet, Link2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CertificateResponse } from '@/types/certificate';

interface CertificatesTableProps {
  certificates: CertificateResponse[];
  isLoading?: boolean;
  onView: (certificate: CertificateResponse) => void;
  onDownload: (certificate: CertificateResponse) => void;
  onDelete: (id: string) => void;
}

// File type icon mapping
function getFileIcon(fileType: string) {
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff'];
  const spreadsheetTypes = ['xls', 'xlsx'];

  if (imageTypes.includes(fileType.toLowerCase())) {
    return <FileImage className="h-4 w-4" />;
  }
  if (spreadsheetTypes.includes(fileType.toLowerCase())) {
    return <FileSpreadsheet className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

// Category badge color
function getCategoryVariant(
  category: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (category?.toUpperCase()) {
    case 'ACCESORIOS':
      return 'default';
    case 'BRIDAS':
      return 'secondary';
    case 'ESPARRAGOS':
      return 'outline';
    case 'FORJADO':
      return 'destructive';
    default:
      return 'secondary';
  }
}

// Format file size
function formatFileSize(bytes: string | null): string {
  if (!bytes) return '-';
  const size = parseInt(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// Group certificates by family (parent + children together)
function groupByFamily(certificates: CertificateResponse[]): CertificateResponse[] {
  const result: CertificateResponse[] = [];
  const processedIds = new Set<string>();

  for (const cert of certificates) {
    // Skip if already processed (as a child of another certificate)
    if (processedIds.has(cert.id)) continue;

    // Add the current certificate
    result.push(cert);
    processedIds.add(cert.id);

    // If it's a parent, add its children immediately after
    if (cert.children && cert.children.length > 0) {
      for (const child of cert.children) {
        const childCert = certificates.find((c) => c.id === child.id);
        if (childCert && !processedIds.has(childCert.id)) {
          result.push(childCert);
          processedIds.add(childCert.id);
        }
      }
    }
  }

  return result;
}

export function CertificatesTable({
  certificates,
  isLoading,
  onView,
  onDownload,
  onDelete,
}: CertificatesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-10">
        <FileText className="mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No se encontraron certificados</p>
        <p className="text-sm">Intenta con otros filtros de búsqueda o sube un nuevo certificado</p>
      </div>
    );
  }

  // Group certificates by family (parent + children together)
  const groupedCertificates = groupByFamily(certificates);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Tipo</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Coladas</TableHead>
            <TableHead>Relación</TableHead>
            <TableHead className="text-right">Tamaño</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-[150px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedCertificates.map((certificate) => (
            <TableRow key={certificate.id} className="hover:bg-muted/50 cursor-pointer">
              <TableCell>{getFileIcon(certificate.file_type)}</TableCell>
              <TableCell
                className="max-w-[300px] truncate font-medium"
                title={certificate.file_name}
                onClick={() => onView(certificate)}
              >
                <div
                  className={
                    certificate.parent ? 'flex items-center gap-2 pl-6' : 'flex items-center gap-2'
                  }
                >
                  {certificate.parent && <span className="text-muted-foreground text-xs">└─</span>}
                  <span className="truncate">{certificate.file_name}</span>
                </div>
              </TableCell>
              <TableCell>
                {certificate.category && (
                  <Badge variant={getCategoryVariant(certificate.category)}>
                    {certificate.category}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {certificate.coladas.slice(0, 3).map((colada) => (
                    <Badge key={colada.id} variant="outline" className="text-xs">
                      {colada.colada_number}
                    </Badge>
                  ))}
                  {certificate.coladas.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{certificate.coladas.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {certificate.parent && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Link2 className="h-3 w-3" />
                      Hijo
                    </Badge>
                  )}
                  {certificate.children && certificate.children.length > 0 && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <FileText className="h-3 w-3" />
                      Padre ({certificate.children.length})
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-right">
                {formatFileSize(certificate.file_size_bytes)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(certificate.created_at), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onView(certificate)}
                    title="Ver certificado"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDownload(certificate)}
                    title="Descargar archivo"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar certificado?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará el certificado &quot;{certificate.file_name}&quot;
                          permanentemente. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(certificate.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
