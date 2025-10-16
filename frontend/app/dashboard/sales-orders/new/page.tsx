'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SalesOrderWizard } from '@/components/salesOrders/SalesOrderWizard';
import Link from 'next/link';

export default function NewSalesOrderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/sales-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Pedido</h1>
          <p className="text-muted-foreground">Crea un nuevo pedido de venta</p>
        </div>
      </div>

      <SalesOrderWizard />
    </div>
  );
}


