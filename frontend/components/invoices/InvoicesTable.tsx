'use client';

import { useState } from 'react';
import { Eye, XCircle, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import type { InvoiceListDto } from '@/types/invoice';
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';

interface InvoicesTableProps {
  invoices: InvoiceListDto[];
  onViewInvoice: (id: number) => void;
  onViewSalesOrder?: (id: number) => void;
  onCancelInvoice?: (id: number) => void;
  onDeleteInvoice?: (id: number) => void;
  onPrintInvoice?: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function InvoicesTable({
  invoices,
  onViewInvoice,
  onViewSalesOrder,
  onCancelInvoice,
  onDeleteInvoice,
  onPrintInvoice,
  currentSortBy,
  currentSortDescending,
  onSort,
}: InvoicesTableProps) {
  const [invoiceToCancel, setInvoiceToCancel] = useState<number | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);

  const getStatusBadge = (invoice: InvoiceListDto) => {
    if (invoice.isCancelled) {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    if (invoice.isPrinted) {
      return <Badge variant="default" className="bg-green-600">Impresa</Badge>;
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const handleCancelConfirm = () => {
    if (invoiceToCancel && onCancelInvoice) {
      onCancelInvoice(invoiceToCancel);
      setInvoiceToCancel(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (invoiceToDelete && onDeleteInvoice) {
      onDeleteInvoice(invoiceToDelete);
      setInvoiceToDelete(null);
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="InvoiceNumber"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                N° Factura
              </SortableTableHead>
              <SortableTableHead
                sortKey="InvoiceDate"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Fecha
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
              <SortableTableHead
                sortKey="TotalAmount"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
                align="right"
              >
                Total
              </SortableTableHead>
              <SortableTableHead>Estado</SortableTableHead>
              <SortableTableHead align="right">Acciones</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No se encontraron facturas
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <ClickableTableRow
                  key={invoice.id}
                  onRowClick={() => onViewInvoice(invoice.id)}
                  aria-label={`Ver detalles de la factura ${invoice.invoiceNumber}`}
                >
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                  <TableCell>{invoice.clientBusinessName}</TableCell>
                  <TableCell>{invoice.salesOrderNumber}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.totalAmount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={ACTION_BUTTON_CONFIG.view.variant}
                        size={ACTION_BUTTON_CONFIG.view.size}
                        onClick={() => onViewInvoice(invoice.id)}
                        title={ACTION_BUTTON_CONFIG.view.title}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {onViewSalesOrder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewSalesOrder(invoice.salesOrderId)}
                          title="Ver Pedido"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {!invoice.isCancelled && !invoice.isPrinted && onPrintInvoice && (
                        <Button
                          variant={ACTION_BUTTON_CONFIG.print.variant}
                          size={ACTION_BUTTON_CONFIG.print.size}
                          onClick={() => onPrintInvoice(invoice.id)}
                          title={ACTION_BUTTON_CONFIG.print.title}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      )}
                      {!invoice.isCancelled && invoice.isPrinted && onCancelInvoice && (
                        <Button
                          variant={ACTION_BUTTON_CONFIG.cancel.variant}
                          size={ACTION_BUTTON_CONFIG.cancel.size}
                          onClick={() => setInvoiceToCancel(invoice.id)}
                          title={ACTION_BUTTON_CONFIG.cancel.title}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {!invoice.isCancelled && !invoice.isPrinted && onDeleteInvoice && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInvoiceToDelete(invoice.id)}
                          title="Eliminar Factura"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={!!invoiceToCancel}
        onOpenChange={() => setInvoiceToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la factura como CANCELADA y restaurará el stock automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              No, volver
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm}>
              Sí, cancelar factura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!invoiceToDelete}
        onOpenChange={() => setInvoiceToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la factura permanentemente. Como la factura no ha sido impresa, no hay cambios en el stock que revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              No, volver
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, eliminar factura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}



