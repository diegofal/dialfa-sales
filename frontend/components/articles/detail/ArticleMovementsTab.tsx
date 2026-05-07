'use client';

import { History } from 'lucide-react';
import { useState } from 'react';
import { StockMovementsTable } from '@/components/articles/StockMovementsTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useStockMovements } from '@/lib/hooks/domain/useStockMovements';

interface Props {
  articleId: number;
}

export function ArticleMovementsTab({ articleId }: Props) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const { data, isLoading, isError } = useStockMovements({
    articleId,
    pageNumber: page,
    pageSize: limit,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Movimientos de Stock
        </CardTitle>
        <CardDescription>
          Compras, ventas, devoluciones, ajustes y transferencias de este artículo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-muted/40 h-9 w-full animate-pulse rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No se pudieron cargar los movimientos.
          </p>
        ) : !data || data.data.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Sin movimientos registrados para este artículo.
          </p>
        ) : (
          <>
            <StockMovementsTable movements={data.data} />
            <div className="mt-4">
              <Pagination
                totalCount={data.pagination.total}
                currentPage={data.pagination.page}
                pageSize={data.pagination.limit}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setLimit(s);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
