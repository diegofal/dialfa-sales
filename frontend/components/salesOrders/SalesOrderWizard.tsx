'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Steps } from '@/components/ui/steps';
import { ClientSelectionStep } from './ClientSelectionStep';
import { ItemsSelectionStep } from './ItemsSelectionStep';
import { OrderSummaryStep } from './OrderSummaryStep';
import type { SalesOrderFormData } from '@/types/salesOrder';
import { useCreateSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function SalesOrderWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SalesOrderFormData>({
    orderDate: new Date().toISOString().split('T')[0],
    items: [],
  });

  const createOrderMutation = useCreateSalesOrder();

  const steps = [
    { title: 'Cliente y Fechas', description: 'Selecciona el cliente y las fechas' },
    { title: 'Artículos', description: 'Agrega los artículos al pedido' },
    { title: 'Resumen', description: 'Revisa y confirma el pedido' },
  ];

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return !!formData.clientId && !!formData.orderDate;
      case 1:
        return formData.items.length > 0 && formData.items.every(
          (item) => item.quantity > 0 && item.unitPrice >= 0
        );
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.clientId) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    try {
      const request = {
        clientId: formData.clientId,
        orderDate: formData.orderDate,
        deliveryDate: formData.deliveryDate,
        notes: formData.notes,
        items: formData.items.map((item) => ({
          articleId: item.articleId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
        })),
      };

      await createOrderMutation.mutateAsync(request);
      router.push('/dashboard/sales-orders');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Pedido</CardTitle>
          <CardDescription>Completa los siguientes pasos para crear un nuevo pedido</CardDescription>
        </CardHeader>
        <CardContent>
          <Steps steps={steps} currentStep={currentStep} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <ClientSelectionStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 1 && (
            <ItemsSelectionStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 2 && (
            <OrderSummaryStep formData={formData} />
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Anterior
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/sales-orders')}
            >
              Cancelar
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!isStepValid()}>
                Siguiente
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!isStepValid() || createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? 'Creando...' : 'Crear Pedido'}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}


