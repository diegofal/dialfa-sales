'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { CUITInput } from '@/components/ui/cuit-input';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateClient, useUpdateClient, useNextClientCode } from '@/lib/hooks/domain/useClients';
import { useTaxConditions } from '@/lib/hooks/domain/useLookups';
import { usePaymentTerms } from '@/lib/hooks/domain/usePaymentTerms';
import type { ClientDto } from '@/types/api';

const clientSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  businessName: z.string().min(1, 'La razón social es requerida'),
  cuit: z.string().min(1, 'El CUIT es requerido'),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  taxConditionId: z.number().int().positive('Debe seleccionar una condición de IVA'),
  paymentTermId: z.number().int().positive('Debe seleccionar una condición de pago'),
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
  const { data: taxConditions = [], isLoading: loadingTaxConditions } = useTaxConditions();
  const { data: paymentTerms = [], isLoading: loadingPaymentTerms } = usePaymentTerms({
    activeOnly: true,
  });
  const { data: nextCode, refetch: refetchNextCode } = useNextClientCode();
  const isEditing = !!client;

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
      taxConditionId: undefined as unknown as number,
      paymentTermId: undefined as unknown as number,
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
        taxConditionId: Number(client.taxConditionId),
        paymentTermId: client.paymentTermId,
      });
    } else {
      // Para nuevo cliente, obtener el siguiente código
      refetchNextCode().then(() => {
        form.reset({
          code: nextCode || '',
          businessName: '',
          cuit: '',
          address: '',
          city: '',
          postalCode: '',
          phone: '',
          email: '',
          taxConditionId: undefined as unknown as number,
          paymentTermId: undefined as unknown as number,
        });
      });
    }
  }, [client, form, nextCode, refetchNextCode]);

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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del cliente' : 'Completa los datos del nuevo cliente'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CLI001" disabled={!isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cuit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CUIT *</FormLabel>
                    <FormControl>
                      <CUITInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
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
                  <FormItem>
                    <FormLabel>Código Postal</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="taxConditionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condición IVA *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ''}
                      disabled={loadingTaxConditions}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una condición" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taxConditions.map((condition) => (
                          <SelectItem key={condition.id} value={condition.id.toString()}>
                            {condition.name}
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
                name="paymentTermId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condición de Pago *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ''}
                      disabled={loadingPaymentTerms}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una condición de pago" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentTerms.map((term) => (
                          <SelectItem key={term.id} value={term.id.toString()}>
                            {term.name}
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
