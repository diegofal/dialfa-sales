'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateClient, useUpdateClient } from '@/lib/hooks/useClients';
import { formatCuit } from '@/lib/utils/formatters';
import type { ClientDto } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const clientSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  businessName: z.string().min(1, 'La razón social es requerida'),
  cuit: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  taxConditionId: z.number().min(1, 'La condición de IVA es requerida'),
  operationTypeId: z.number().min(1, 'El tipo de operatoria es requerido'),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onClose: () => void;
  client?: ClientDto | null;
}

export default function ClientDialog({ open, onClose, client }: ClientDialogProps) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isEditing = !!client;

  // Fetch lookup data
  const [taxConditions, setTaxConditions] = useState<{ id: number; name: string }[]>([]);
  const [operationTypes, setOperationTypes] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    // Fetch tax conditions and operation types
    Promise.all([
      fetch('/api/lookups/tax-conditions').then(r => r.json()),
      fetch('/api/lookups/operation-types').then(r => r.json()),
    ]).then(([taxConds, opTypes]) => {
      setTaxConditions(taxConds);
      setOperationTypes(opTypes);
    });
  }, []);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      code: '',
      businessName: '',
      cuit: '',
      address: '',
      city: '',
      postalCode: '',
      phone: '',
      email: '',
      taxConditionId: 1,
      operationTypeId: 1,
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        code: client.code,
        businessName: client.businessName,
        cuit: client.cuit || '',
        address: client.address || '',
        city: client.city || '',
        postalCode: client.postalCode || '',
        phone: client.phone || '',
        email: client.email || '',
        taxConditionId: client.taxConditionId,
        operationTypeId: client.operationTypeId,
      });
    } else {
      form.reset({
        code: '',
        businessName: '',
        cuit: '',
        address: '',
        city: '',
        postalCode: '',
        phone: '',
        email: '',
        taxConditionId: 1,
        operationTypeId: 1,
      });
    }
  }, [client, form]);

  const onSubmit = async (data: ClientFormValues) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: client.id,
          data: {
            ...data,
            id: client.id,
          },
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      onClose();
      form.reset();
    } catch {
      // Error handling is done in the mutation hooks
    }
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del cliente'
              : 'Completa los datos del nuevo cliente'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Código y CUIT en proporción 1:2 */}
            <div className="grid grid-cols-7 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CLI001" disabled={isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cuit"
                render={({ field }) => (
                  <FormItem className="col-span-5">
                    <FormLabel>CUIT</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="20-12345678-9"
                        value={field.value ? formatCuit(field.value) : ''}
                        onChange={(e) => {
                          // Remove formatting and only keep digits
                          const digits = e.target.value.replace(/\D/g, '');
                          field.onChange(digits);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Razón Social - ancho completo */}
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón Social *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Razón Social del Cliente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Domicilio - ancho completo */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domicilio</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Calle 123" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ciudad (2/3) y Código Postal (1/3) */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Buenos Aires" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Código Postal</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Teléfono y Email - mitades iguales */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+54 11 1234-5678" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="cliente@ejemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Condición IVA y Tipo de Operatoria - mitades iguales */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="taxConditionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condición IVA *</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar condición IVA" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taxConditions.map((tc) => (
                          <SelectItem key={tc.id} value={tc.id.toString()}>
                            {tc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operationTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Operatoria *</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {operationTypes.map((ot) => (
                          <SelectItem key={ot.id} value={ot.id.toString()}>
                            {ot.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Guardando...'
                  : isEditing
                  ? 'Actualizar'
                  : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


