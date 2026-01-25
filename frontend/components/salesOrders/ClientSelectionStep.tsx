'use client';

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
import { useClients } from '@/lib/hooks/domain/useClients';
import type { SalesOrderFormData } from '@/types/salesOrder';

interface ClientSelectionStepProps {
  formData: SalesOrderFormData;
  setFormData: (data: SalesOrderFormData) => void;
}

export function ClientSelectionStep({ formData, setFormData }: ClientSelectionStepProps) {
  const { data: clientsResult, isLoading } = useClients({});
  const clients = clientsResult?.data || [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="client">Cliente *</Label>
        <Select
          value={formData.clientId?.toString()}
          onValueChange={(value) => setFormData({ ...formData, clientId: parseInt(value) })}
        >
          <SelectTrigger id="client">
            <SelectValue
              placeholder={isLoading ? 'Cargando clientes...' : 'Selecciona un cliente'}
            />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.code} - {client.businessName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">Selecciona el cliente para el pedido</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="orderDate">Fecha de Pedido *</Label>
          <Input
            id="orderDate"
            type="date"
            value={formData.orderDate}
            onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deliveryDate">Fecha de Entrega</Label>
          <Input
            id="deliveryDate"
            type="date"
            value={formData.deliveryDate || ''}
            onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
            min={formData.orderDate}
          />
          <p className="text-muted-foreground text-sm">Fecha estimada de entrega</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          placeholder="Observaciones adicionales..."
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={4}
        />
      </div>
    </div>
  );
}
