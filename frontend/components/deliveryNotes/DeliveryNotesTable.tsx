'use client';

import { Eye, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import type { DeliveryNoteListDto } from '@/types/deliveryNote';
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';
import { useDownloadDeliveryNotePdf, usePrintDeliveryNote } from '@/lib/hooks/useDeliveryNotes';
import { useRouter } from 'next/navigation';

interface DeliveryNotesTableProps {
  deliveryNotes: DeliveryNoteListDto[];
  onViewDeliveryNote: (id: number) => void;
  onDeleteDeliveryNote?: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function DeliveryNotesTable({
  deliveryNotes,
  onViewDeliveryNote,
  onDeleteDeliveryNote,
  currentSortBy,
  currentSortDescending,
  onSort,
}: DeliveryNotesTableProps) {
  const router = useRouter();
  const [deliveryNoteToDelete, setDeliveryNoteToDelete] = useState<number | null>(null);
  const downloadPdfMutation = useDownloadDeliveryNotePdf();
  const printDeliveryNoteMutation = usePrintDeliveryNote();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const handleDeleteConfirm = () => {
    if (deliveryNoteToDelete && onDeleteDeliveryNote) {
      onDeleteDeliveryNote(deliveryNoteToDelete);
      setDeliveryNoteToDelete(null);
    }
  };

  const handleDownloadPdf = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadPdfMutation.mutate(id);
  };

  const handlePrint = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    printDeliveryNoteMutation.mutate(id);
  };

  const getStatusBadge = (deliveryNote: DeliveryNoteListDto) => {
    if (deliveryNote.isPrinted) {
      return <Badge variant="default" className="bg-green-600">Impreso</Badge>;
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const handleViewSalesOrder = (salesOrderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/dashboard/sales-orders/${salesOrderId}/edit`);
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="DeliveryNumber"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                N° Remito
              </SortableTableHead>
              <SortableTableHead
                sortKey="DeliveryDate"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Fecha Entrega
              </SortableTableHead>
              <SortableTableHead
                sortKey="ClientBusinessName"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Cliente
              </SortableTableHead>
              <SortableTableHead>N° Pedido</SortableTableHead>
              <SortableTableHead>Transportista</SortableTableHead>
              <SortableTableHead align="right">Bultos</SortableTableHead>
              <SortableTableHead>Estado</SortableTableHead>
              <SortableTableHead align="right">Acciones</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveryNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No se encontraron remitos
                </TableCell>
              </TableRow>
            ) : (
              deliveryNotes.map((deliveryNote) => (
                <ClickableTableRow
                  key={deliveryNote.id}
                  onRowClick={() => onViewDeliveryNote(deliveryNote.id)}
                  aria-label={`Ver detalles del remito ${deliveryNote.deliveryNumber}`}
                >
                  <TableCell className="font-medium">{deliveryNote.deliveryNumber}</TableCell>
                  <TableCell>{formatDate(deliveryNote.deliveryDate)}</TableCell>
                  <TableCell>{deliveryNote.clientBusinessName}</TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={(e) => handleViewSalesOrder(deliveryNote.salesOrderId, e)}
                    >
                      {deliveryNote.salesOrderNumber}
                    </Button>
                  </TableCell>
                  <TableCell>{deliveryNote.transporterName || '-'}</TableCell>
                  <TableCell className="text-right">
                    {deliveryNote.packagesCount || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(deliveryNote)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={ACTION_BUTTON_CONFIG.view.variant}
                        size={ACTION_BUTTON_CONFIG.view.size}
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDeliveryNote(deliveryNote.id);
                        }}
                        title={ACTION_BUTTON_CONFIG.view.title}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={ACTION_BUTTON_CONFIG.print.variant}
                        size={ACTION_BUTTON_CONFIG.print.size}
                        onClick={(e) => handlePrint(deliveryNote.id, e)}
                        disabled={printDeliveryNoteMutation.isPending}
                        title="Imprimir"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {onDeleteDeliveryNote && (
                        <Button
                          variant={ACTION_BUTTON_CONFIG.delete.variant}
                          size={ACTION_BUTTON_CONFIG.delete.size}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeliveryNoteToDelete(deliveryNote.id);
                          }}
                          title={ACTION_BUTTON_CONFIG.delete.title}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </ClickableTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deliveryNoteToDelete}
        onOpenChange={() => setDeliveryNoteToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar remito?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el remito de forma permanente. Esta operación no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}









