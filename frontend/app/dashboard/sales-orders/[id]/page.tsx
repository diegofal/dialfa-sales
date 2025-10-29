'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  
  useEffect(() => {
    // Redirect to the edit page which will handle both viewing and editing
    router.replace(`/dashboard/sales-orders/${orderId}/edit`);
  }, [orderId, router]);

  return (
    <div className="flex items-center justify-center h-96">
      <p className="text-muted-foreground">Cargando...</p>
    </div>
  );
}

