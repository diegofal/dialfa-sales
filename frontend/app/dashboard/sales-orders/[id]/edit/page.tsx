'use client';

import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SingleStepOrderForm } from '@/components/salesOrders/SingleStepOrderForm';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function EditSalesOrderPage() {
  const params = useParams();
  const orderId = params.id ? Number(params.id) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/sales-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {orderId ? 'Editar Pedido' : 'Nuevo Pedido'}
          </h1>
        </div>
      </div>

      <Suspense fallback={<div className="text-center py-12">Cargando...</div>}>
        <SingleStepOrderForm orderId={orderId} />
      </Suspense>
    </div>
  );
}


