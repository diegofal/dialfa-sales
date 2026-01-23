'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ROUTES } from '@/lib/constants/routes';

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);

  useEffect(() => {
    // Redirect to the edit page which will handle both viewing and editing
    router.replace(`${ROUTES.SALES_ORDERS}/${orderId}/edit`);
  }, [orderId, router]);

  return (
    <div className="flex h-96 items-center justify-center">
      <p className="text-muted-foreground">Cargando...</p>
    </div>
  );
}
