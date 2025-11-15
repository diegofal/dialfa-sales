'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Edit, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDeliveryNote, useDownloadDeliveryNotePdf } from '@/lib/hooks/useDeliveryNotes';
import { useQuickDeliveryNoteTabs } from '@/lib/hooks/useQuickDeliveryNoteTabs';
import { useEffect } from 'react';

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryNoteId = Number(params.id);
  
  const { data: deliveryNote, isLoading } = useDeliveryNote(deliveryNoteId);
  const downloadPdfMutation = useDownloadDeliveryNotePdf();
  const { addTab } = useQuickDeliveryNoteTabs();

  // Add to tabs when deliveryNote is loaded
  useEffect(() => {
    if (deliveryNote) {
      addTab({
        id: `dn-${deliveryNote.id}`,
        deliveryNoteId: deliveryNote.id,
        deliveryNumber: deliveryNote.deliveryNumber,
        clientName: deliveryNote.clientBusinessName,
        salesOrderNumber: deliveryNote.salesOrderNumber,
      });
    }
  }, [deliveryNote, addTab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Cargando remito...</p>
      </div>
    );
  }

  if (!deliveryNote) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Remito no encontrado</p>
        <Button onClick={() => router.push('/dashboard/sales-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al listado
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const handleDownloadPdf = () => {
    downloadPdfMutation.mutate(deliveryNoteId);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Remito {deliveryNote.deliveryNumber}</h1>
            <p className="text-muted-foreground">
              Fecha de Entrega: {formatDate(deliveryNote.deliveryDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadPdfMutation.isPending}>
            <Printer className="mr-2 h-4 w-4" />
            {downloadPdfMutation.isPending ? 'Descargando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Razón Social</p>
              <p className="font-medium">{deliveryNote.clientBusinessName}</p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Note Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Remito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Pedido N°</p>
              <p className="font-medium">
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => router.push(`/dashboard/sales-orders/${deliveryNote.salesOrderId}/edit`)}
                >
                  {deliveryNote.salesOrderNumber}
                </Button>
              </p>
            </div>
            {deliveryNote.transporterName && (
              <div>
                <p className="text-sm text-muted-foreground">Transportista</p>
                <p className="font-medium">{deliveryNote.transporterName}</p>
              </div>
            )}
            {deliveryNote.weightKg && (
              <div>
                <p className="text-sm text-muted-foreground">Peso (kg)</p>
                <p className="font-medium">{deliveryNote.weightKg.toFixed(2)} kg</p>
              </div>
            )}
            {deliveryNote.packagesCount && (
              <div>
                <p className="text-sm text-muted-foreground">Cantidad de Bultos</p>
                <p className="font-medium">{deliveryNote.packagesCount}</p>
              </div>
            )}
            {deliveryNote.declaredValue && (
              <div>
                <p className="text-sm text-muted-foreground">Valor Declarado</p>
                <p className="font-medium">
                  {new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: 'ARS',
                    minimumFractionDigits: 2,
                  }).format(deliveryNote.declaredValue)}
                </p>
              </div>
            )}
            {deliveryNote.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Observaciones</p>
                <p className="font-medium">{deliveryNote.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items Entregados</CardTitle>
          <CardDescription>{deliveryNote.items?.length || 0} artículo(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveryNote.items && deliveryNote.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.articleCode}</TableCell>
                    <TableCell>{item.articleDescription}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay items registrados en este remito
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Fecha de Creación</p>
            <p className="font-medium">{formatDate(deliveryNote.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Última Actualización</p>
            <p className="font-medium">{formatDate(deliveryNote.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}














