'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { SingleStepOrderForm } from '@/components/salesOrders/SingleStepOrderForm';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';

export default function NewSalesOrderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={ROUTES.SALES_ORDERS}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Pedido</h1>
        </div>
      </div>

      <Suspense fallback={<div className="py-12 text-center">Cargando...</div>}>
        <SingleStepOrderForm />
      </Suspense>
    </div>
  );
}
