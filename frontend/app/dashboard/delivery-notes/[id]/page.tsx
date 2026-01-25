'use client';

import { ArrowLeft, Printer, Trash2, Eye } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/lib/constants/routes';
import {
  useDeliveryNote,
  usePrintDeliveryNote,
  useUpdateDeliveryNote,
  useDeleteDeliveryNote,
} from '@/lib/hooks/domain/useDeliveryNotes';
import { useQuickDeliveryNoteTabs } from '@/lib/hooks/domain/useQuickDeliveryNoteTabs';

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryNoteId = Number(params.id);

  const { data: deliveryNote, isLoading } = useDeliveryNote(deliveryNoteId);
  const printDeliveryNoteMutation = usePrintDeliveryNote();
  const updateDeliveryNoteMutation = useUpdateDeliveryNote();
  const deleteDeliveryNoteMutation = useDeleteDeliveryNote();
  const { addTab, removeTab } = useQuickDeliveryNoteTabs();

  const [transporters, setTransporters] = useState<
    Array<{ id: number; name: string; address: string | null }>
  >([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
      .then((res) => res.json())
      .then((data) => setTransporters(data))
      .catch((err) => console.error('Error loading transporters:', err));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Cargando remito...</p>
      </div>
    );
  }

  if (!deliveryNote) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Remito no encontrado</p>
        <Button onClick={() => router.push(ROUTES.SALES_ORDERS)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al listado
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const getStatusBadge = () => {
    if (deliveryNote?.isPrinted) {
      return (
        <Badge variant="default" className="bg-green-600">
          Impreso
        </Badge>
      );
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const handlePrint = () => {
    printDeliveryNoteMutation.mutate(deliveryNoteId);
  };

  const handleDelete = () => {
    deleteDeliveryNoteMutation.mutate(deliveryNoteId, {
      onSuccess: () => {
        // Remove tab from sidebar if it exists
        removeTab(`dn-${deliveryNoteId}`);
        setShowDeleteDialog(false);
        router.push(ROUTES.DELIVERY_NOTES);
      },
    });
  };

  const handleFieldUpdate = (field: keyof typeof editData, value: string | number | null) => {
    if (!deliveryNote) return;

    const updateData = {
      deliveryDate: deliveryNote.deliveryDate,
      transporterId: field === 'transporterId' ? (value as number | null) : editData.transporterId,
      weightKg:
        field === 'weightKg'
          ? value
            ? parseFloat(value as string)
            : null
          : editData.weightKg
            ? parseFloat(editData.weightKg)
            : null,
      packagesCount:
        field === 'packagesCount'
          ? value
            ? parseInt(value as string)
            : null
          : editData.packagesCount
            ? parseInt(editData.packagesCount)
            : null,
      declaredValue:
        field === 'declaredValue'
          ? value
            ? parseFloat(value as string)
            : null
          : editData.declaredValue
            ? parseFloat(editData.declaredValue)
            : null,
      notes: field === 'notes' ? (value as string).trim() || null : editData.notes.trim() || null,
    };

    updateDeliveryNoteMutation.mutate({ id: deliveryNoteId, data: updateData });
  };

  const selectedTransporter = transporters.find((t) => t.id === editData.transporterId);

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
          {getStatusBadge()}
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
              <p className="text-muted-foreground text-sm">Razón Social</p>
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
              <p className="text-muted-foreground text-sm">Pedido N°</p>
              <p className="font-medium">
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(`${ROUTES.SALES_ORDERS}/${deliveryNote.salesOrderId}/edit`)
                  }
                >
                  {deliveryNote.salesOrderNumber}
                </Button>
              </p>
            </div>

            {/* Transportista */}
            <div>
              <p className="text-muted-foreground mb-1 text-sm">Transportista</p>
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
                <p className="text-muted-foreground text-sm">Domicilio Transportista</p>
                <p className="font-medium">
                  {selectedTransporter?.address || deliveryNote.transporterAddress || '-'}
                </p>
              </div>
            )}

            {/* Peso */}
            <div>
              <p className="text-muted-foreground mb-1 text-sm">Peso (kg)</p>
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
              <p className="text-muted-foreground mb-1 text-sm">Cantidad de Bultos</p>
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
              <p className="text-muted-foreground mb-1 text-sm">Valor Declarado ($)</p>
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
              <p className="text-muted-foreground mb-1 text-sm">Observaciones</p>
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
            <p className="text-muted-foreground py-4 text-center text-sm">
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
            <p className="text-muted-foreground text-sm">Fecha de Creación</p>
            <p className="font-medium">{formatDate(deliveryNote.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Última Actualización</p>
            <p className="font-medium">{formatDate(deliveryNote.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Action Buttons */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(ROUTES.DELIVERY_NOTES)}>
                Volver
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteDeliveryNoteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`${ROUTES.SALES_ORDERS}/${deliveryNote.salesOrderId}/edit`)
                }
              >
                Ver Pedido
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`/api/delivery-notes/${deliveryNote.id}/pdf`, '_blank')}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver PDF
              </Button>
              <Button onClick={handlePrint} disabled={printDeliveryNoteMutation.isPending}>
                <Printer className="mr-2 h-4 w-4" />
                {printDeliveryNoteMutation.isPending ? 'Imprimiendo...' : 'Imprimir'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar remito?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el remito {deliveryNote.deliveryNumber}. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteDeliveryNoteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteDeliveryNoteMutation.isPending ? 'Eliminando...' : 'Eliminar Remito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
