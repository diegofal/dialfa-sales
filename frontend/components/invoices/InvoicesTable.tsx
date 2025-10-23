'use client';

import { useState } from 'react';
import { Eye, XCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';
import type { InvoiceListDto } from '@/types/invoice';

interface InvoicesTableProps {
  invoices: InvoiceListDto[];
  onViewInvoice: (id: number) => void;
  onCancelInvoice?: (id: number, reason: string) => void;
  onPrintInvoice?: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function InvoicesTable({
  invoices,
  onViewInvoice,
  onCancelInvoice,
  onPrintInvoice,
  currentSortBy,
  currentSortDescending,
  onSort,
}: InvoicesTableProps) {
  const [invoiceToCancel, setInvoiceToCancel] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

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
    if (invoiceToCancel && onCancelInvoice && cancellationReason.trim()) {
      onCancelInvoice(invoiceToCancel, cancellationReason);
      setInvoiceToCancel(null);
      setCancellationReason('');
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
              <SortableTableHead align="right">Items</SortableTableHead>
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
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No se encontraron facturas
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                  <TableCell>{invoice.clientBusinessName}</TableCell>
                  <TableCell>{invoice.salesOrderNumber}</TableCell>
                  <TableCell className="text-right">{invoice.itemsCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.totalAmount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewInvoice(invoice.id)}
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!invoice.isCancelled && !invoice.isPrinted && onPrintInvoice && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onPrintInvoice(invoice.id)}
                          title="Imprimir factura"
                        >
                          <Printer className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {!invoice.isCancelled && !invoice.isPrinted && onCancelInvoice && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInvoiceToCancel(invoice.id)}
                          title="Cancelar factura"
                        >
                          <XCircle className="h-4 w-4 text-orange-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={!!invoiceToCancel}
        onOpenChange={() => {
          setInvoiceToCancel(null);
          setCancellationReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la factura como CANCELADA. Debe proporcionar un motivo de
              cancelación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Motivo de cancelación
            </label>
            <Input
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Ingrese el motivo de la cancelación"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancellationReason('')}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={!cancellationReason.trim()}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}



