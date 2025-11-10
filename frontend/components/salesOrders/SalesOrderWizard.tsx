'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Steps } from '@/components/ui/steps';
import { ClientSelectionStep } from './ClientSelectionStep';
import { ItemsSelectionStep } from './ItemsSelectionStep';
import { OrderSummaryStep } from './OrderSummaryStep';
import type { SalesOrderFormData } from '@/types/salesOrder';
import { useCreateSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuickCart } from '@/lib/hooks/useQuickCart';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart } from 'lucide-react';

export function SalesOrderWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuickCart = searchParams.get('fromQuickCart') === 'true';
  const { items: quickCartItems, clearCart } = useQuickCart();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SalesOrderFormData>({
    orderDate: new Date().toISOString().split('T')[0],
    items: [],
  });
  const [loadedFromCart, setLoadedFromCart] = useState(false);

  const createOrderMutation = useCreateSalesOrder();

  // Load items from quick cart if coming from there
  useEffect(() => {
    if (fromQuickCart && quickCartItems.length > 0 && !loadedFromCart) {
      const cartItems = quickCartItems.map((item) => ({
        articleId: item.article.id,
        articleCode: item.article.code,
        articleDescription: item.article.description,
        quantity: item.quantity,
        unitPrice: item.article.unitPrice,
        discountPercent: 0,
      }));
      
      setFormData((prev) => ({
        ...prev,
        items: cartItems,
      }));
      
      setLoadedFromCart(true);
      toast.success(`${quickCartItems.length} artículo(s) cargados desde la consulta rápida`);
    }
  }, [fromQuickCart, quickCartItems, loadedFromCart]);

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
      
      // Clear quick cart if loaded from there
      if (fromQuickCart && loadedFromCart) {
        clearCart();
        toast.success('Pedido creado y lista de consulta limpiada');
      }
      
      // After creating order, navigate to edit view to continue working
      router.push('/dashboard/sales-orders');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  return (
    <div className="space-y-6">
      {fromQuickCart && loadedFromCart && (
        <Alert>
          <ShoppingCart className="h-4 w-4" />
          <AlertDescription>
            Se han cargado {formData.items.length} artículo(s) desde tu lista de consulta rápida. 
            Selecciona el cliente para continuar con el pedido.
          </AlertDescription>
        </Alert>
      )}

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



