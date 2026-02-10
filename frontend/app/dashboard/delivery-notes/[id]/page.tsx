'use client';

import { ArrowLeft, Edit2, Printer, Save, Trash2, Eye, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
    weightKg: '',
    packagesCount: '',
    declaredValue: '',
    notes: '',
  });

  // Transporter inline editing state
  const [isEditingTransporter, setIsEditingTransporter] = useState(false);
  const [editedTransporterName, setEditedTransporterName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const transporterInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
      .catch(() => {});
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        transporterInputRef.current &&
        !transporterInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      transporterId: deliveryNote.transporterId,
      transporterName: deliveryNote.transporterName,
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

  // Transporter edit handlers
  const handleStartEditTransporter = () => {
    setEditedTransporterName(deliveryNote.transporterName || '');
    setIsEditingTransporter(true);
    setShowSuggestions(false);
    setTimeout(() => transporterInputRef.current?.focus(), 0);
  };

  const handleCancelEditTransporter = () => {
    setIsEditingTransporter(false);
    setEditedTransporterName('');
    setShowSuggestions(false);
  };

  const handleSaveTransporter = (name?: string) => {
    if (!deliveryNote) return;

    const transporterNameValue = (name ?? editedTransporterName).trim();

    // Check if it matches an existing transporter
    const matchedTransporter = transporters.find(
      (t) => t.name.toLowerCase() === transporterNameValue.toLowerCase()
    );

    const updateData = {
      deliveryDate: deliveryNote.deliveryDate,
      transporterId: matchedTransporter ? matchedTransporter.id : null,
      transporterName: matchedTransporter ? null : transporterNameValue || null,
      weightKg: editData.weightKg ? parseFloat(editData.weightKg) : null,
      packagesCount: editData.packagesCount ? parseInt(editData.packagesCount) : null,
      declaredValue: editData.declaredValue ? parseFloat(editData.declaredValue) : null,
      notes: editData.notes.trim() || null,
    };

    updateDeliveryNoteMutation.mutate(
      { id: deliveryNoteId, data: updateData },
      {
        onSuccess: () => {
          setIsEditingTransporter(false);
          setEditedTransporterName('');
          setShowSuggestions(false);
        },
      }
    );
  };

  const handleSelectSuggestion = (transporter: { id: number; name: string }) => {
    setEditedTransporterName(transporter.name);
    setShowSuggestions(false);
    handleSaveTransporter(transporter.name);
  };

  // Filter suggestions based on current input
  const filteredSuggestions = editedTransporterName.trim()
    ? transporters.filter((t) => t.name.toLowerCase().includes(editedTransporterName.toLowerCase()))
    : transporters;

  // Get the currently linked transporter (for showing address)
  const linkedTransporter = transporters.find((t) => t.id === deliveryNote.transporterId);

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

            {/* Transportista - Editable with text input */}
            <div>
              <p className="text-muted-foreground mb-1 text-sm">Transportista</p>
              {isEditingTransporter ? (
                <div className="relative">
                  <div className="flex items-center gap-1">
                    <Input
                      ref={transporterInputRef}
                      type="text"
                      value={editedTransporterName}
                      onChange={(e) => {
                        setEditedTransporterName(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTransporter();
                        if (e.key === 'Escape') handleCancelEditTransporter();
                      }}
                      placeholder="Nombre del transportista..."
                      className="h-8"
                      disabled={updateDeliveryNoteMutation.isPending}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleSaveTransporter()}
                      disabled={updateDeliveryNoteMutation.isPending}
                      title="Guardar"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={handleCancelEditTransporter}
                      disabled={updateDeliveryNoteMutation.isPending}
                      title="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Suggestions dropdown */}
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="bg-popover border-border absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border shadow-md"
                    >
                      {filteredSuggestions.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSuggestion(t)}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="font-medium">
                    {deliveryNote.transporterName || 'Sin transportista'}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleStartEditTransporter}
                    title="Editar transportista"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Domicilio del Transportista - solo si hay transportista vinculado */}
            {linkedTransporter?.address && (
              <div>
                <p className="text-muted-foreground text-sm">Domicilio Transportista</p>
                <p className="font-medium">{linkedTransporter.address}</p>
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
