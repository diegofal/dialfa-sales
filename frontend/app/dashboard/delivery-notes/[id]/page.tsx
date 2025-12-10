'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { useDeliveryNote, useDownloadDeliveryNotePdf, useUpdateDeliveryNote } from '@/lib/hooks/useDeliveryNotes';
import { useQuickDeliveryNoteTabs } from '@/lib/hooks/useQuickDeliveryNoteTabs';
import { useEffect, useState } from 'react';

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryNoteId = Number(params.id);
  
  const { data: deliveryNote, isLoading } = useDeliveryNote(deliveryNoteId);
  const downloadPdfMutation = useDownloadDeliveryNotePdf();
  const updateDeliveryNoteMutation = useUpdateDeliveryNote();
  const { addTab } = useQuickDeliveryNoteTabs();

  const [transporters, setTransporters] = useState<Array<{ id: number; name: string; address: string | null }>>([]);
  const [editData, setEditData] = useState({
    transporterId: null as number | null,
    weightKg: '',
    packagesCount: '',
    declaredValue: '',
    notes: '',
  });

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
      // Initialize edit data
      setEditData({
        transporterId: deliveryNote.transporterId,
        weightKg: deliveryNote.weightKg?.toString() || '',
        packagesCount: deliveryNote.packagesCount?.toString() || '',
        declaredValue: deliveryNote.declaredValue?.toString() || '',
        notes: deliveryNote.notes || '',
      });
    }
  }, [deliveryNote, addTab]);

  // Load transporters on mount
  useEffect(() => {
    fetch('/api/lookups/transporters')
      .then(res => res.json())
      .then(data => setTransporters(data))
      .catch(err => console.error('Error loading transporters:', err));
  }, []);

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

  const handleFieldUpdate = (field: keyof typeof editData, value: string | number | null) => {
    if (!deliveryNote) return;

    const updateData = {
      deliveryDate: deliveryNote.deliveryDate,
      transporterId: field === 'transporterId' ? (value as number | null) : editData.transporterId,
      weightKg: field === 'weightKg' ? (value ? parseFloat(value as string) : null) : (editData.weightKg ? parseFloat(editData.weightKg) : null),
      packagesCount: field === 'packagesCount' ? (value ? parseInt(value as string) : null) : (editData.packagesCount ? parseInt(editData.packagesCount) : null),
      declaredValue: field === 'declaredValue' ? (value ? parseFloat(value as string) : null) : (editData.declaredValue ? parseFloat(editData.declaredValue) : null),
      notes: field === 'notes' ? ((value as string).trim() || null) : (editData.notes.trim() || null),
    };

    updateDeliveryNoteMutation.mutate({ id: deliveryNoteId, data: updateData });
  };

  const selectedTransporter = transporters.find(t => t.id === editData.transporterId);

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
          <CardContent className="space-y-3">
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
            
            {/* Transportista */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Transportista</p>
              <Combobox
                options={[
                  { value: 'none', label: 'Sin transportista' },
                  ...transporters.map((t) => ({
                    value: String(t.id),
                    label: t.name,
                  })),
                ]}
                value={editData.transporterId ? String(editData.transporterId) : 'none'}
                onValueChange={(value) => {
                  const transporterId = value === 'none' ? null : Number(value);
                  setEditData({ ...editData, transporterId });
                  handleFieldUpdate('transporterId', transporterId);
                }}
                placeholder="Sin transportista"
                emptyMessage="No se encontraron transportistas"
              />
            </div>

            {/* Domicilio del Transportista */}
            {(selectedTransporter?.address || deliveryNote.transporterAddress) && (
              <div>
                <p className="text-sm text-muted-foreground">Domicilio Transportista</p>
                <p className="font-medium">
                  {selectedTransporter?.address || deliveryNote.transporterAddress || '-'}
                </p>
              </div>
            )}

            {/* Peso */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Peso (kg)</p>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editData.weightKg}
                onChange={(e) => setEditData({ ...editData, weightKg: e.target.value })}
                onBlur={(e) => handleFieldUpdate('weightKg', e.target.value)}
              />
            </div>

            {/* Bultos */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Cantidad de Bultos</p>
              <Input
                type="number"
                placeholder="0"
                value={editData.packagesCount}
                onChange={(e) => setEditData({ ...editData, packagesCount: e.target.value })}
                onBlur={(e) => handleFieldUpdate('packagesCount', e.target.value)}
              />
            </div>

            {/* Valor Declarado */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Valor Declarado ($)</p>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editData.declaredValue}
                onChange={(e) => setEditData({ ...editData, declaredValue: e.target.value })}
                onBlur={(e) => handleFieldUpdate('declaredValue', e.target.value)}
              />
            </div>

            {/* Observaciones */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Observaciones</p>
              <Textarea
                placeholder="Observaciones adicionales..."
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                onBlur={(e) => handleFieldUpdate('notes', e.target.value)}
                rows={3}
              />
            </div>
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














