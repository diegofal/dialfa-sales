'use client';

import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { SingleStepOrderForm } from '@/components/salesOrders/SingleStepOrderForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ROUTES } from '@/lib/constants/routes';
import { useSalesOrderPermissions } from '@/lib/hooks/domain/useSalesOrderPermissions';
import { useSalesOrder } from '@/lib/hooks/domain/useSalesOrders';

export default function EditSalesOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id ? Number(params.id) : undefined;
  const { data: existingOrder } = useSalesOrder(orderId || 0);
  const permissions = useSalesOrderPermissions(existingOrder);

  const getStatusBadge = () => {
    if (!existingOrder) return null;

    // Solo mostrar badge de factura si existe y NO está cancelada
    if (existingOrder.invoice && !existingOrder.invoice.isCancelled) {
      if (existingOrder.invoice.isPrinted) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="cursor-help bg-red-600 hover:bg-red-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Factura Impresa
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Este pedido tiene una factura impresa. No se pueden realizar modificaciones. El
                  stock ya fue debitado y el movimiento contable fue registrado.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      } else {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="cursor-help bg-blue-600">
                  Con Factura
                </Badge>
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
              <Badge variant="default" className="cursor-help bg-purple-600">
                Con Remito
              </Badge>
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
            <Badge variant="secondary" className="cursor-help">
              Pendiente
            </Badge>
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
          <Link href={ROUTES.SALES_ORDERS}>
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
                        <Badge variant="outline" className="cursor-help">
                          Solo lectura
                        </Badge>
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
                  console.warn('🚚 Ver Remito clicked');
                  router.push(`${ROUTES.DELIVERY_NOTES}/${existingOrder.deliveryNote?.id}`);
                }}
              >
                Ver Remito
              </Button>
            )}
          </div>
        )}
      </div>

      <Suspense fallback={<div className="py-12 text-center">Cargando...</div>}>
        <SingleStepOrderForm orderId={orderId} />
      </Suspense>
    </div>
  );
}
