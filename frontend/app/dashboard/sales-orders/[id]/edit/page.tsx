'use client';

import { Suspense, useState } from 'react';
import { ArrowLeft, AlertTriangle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SingleStepOrderForm } from '@/components/salesOrders/SingleStepOrderForm';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useSalesOrderPermissions } from '@/lib/hooks/useSalesOrderPermissions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function EditSalesOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id ? Number(params.id) : undefined;
  const { data: existingOrder } = useSalesOrder(orderId || 0);
  const permissions = useSalesOrderPermissions(existingOrder, false);

  console.log('🔍 EditSalesOrderPage render:', {
    orderId,
    hasExistingOrder: !!existingOrder,
    existingOrderItems: existingOrder?.items?.length,
    hasDeliveryNote: !!existingOrder?.deliveryNote,
    status: existingOrder?.status,
  });

  const getStatusBadge = () => {
    if (!existingOrder) return null;
    
    if (existingOrder.invoice) {
      if (existingOrder.invoice.isPrinted) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="bg-red-600 hover:bg-red-700 cursor-help">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Factura Impresa
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Este pedido tiene una factura impresa. No se pueden realizar modificaciones. El stock ya fue debitado y el movimiento contable fue registrado.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      } else if (existingOrder.invoice.isCancelled) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="cursor-help">Factura Cancelada</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>La factura asociada fue cancelada. Puede crear una nueva factura.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      } else {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="bg-blue-600 cursor-help">Con Factura</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Este pedido tiene una factura asociada (no impresa).</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    }
    
    if (existingOrder.deliveryNote) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="default" className="bg-purple-600 cursor-help">Con Remito</Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Este pedido tiene un remito asociado.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-help">Pendiente</Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Pedido pendiente sin factura ni remito.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales-orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {orderId ? 'Editar Pedido' : 'Nuevo Pedido'}
            </h1>
            {orderId && existingOrder && (
              <>
                {getStatusBadge()}
                {!permissions.canEdit && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="cursor-help">Solo lectura</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Este pedido no puede ser modificado.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {orderId && existingOrder && (
          <div className="flex gap-2">
            {existingOrder.deliveryNote && (
              <Button
                variant="outline"
                onClick={() => {
                  console.log('🚚 Ver Remito clicked');
                  router.push(`/dashboard/delivery-notes/${existingOrder.deliveryNote?.id}`);
                }}
              >
                Ver Remito
              </Button>
            )}
          </div>
        )}
      </div>

      <Suspense fallback={<div className="text-center py-12">Cargando...</div>}>
        <SingleStepOrderForm orderId={orderId} />
      </Suspense>
    </div>
  );
}


