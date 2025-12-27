'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSupplierOrder, useUpdateSupplierOrderStatus } from '@/lib/hooks/useSupplierOrders';
import { useAuthStore } from '@/store/authStore';
import { SupplierOrderStatus, SupplierOrderItemDto } from '@/types/supplierOrder';
import { formatSaleTime, calculateWeightedAvgSales, calculateEstimatedSaleTime, calculateWeightedAvgSaleTime } from '@/lib/utils/salesCalculations';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Article } from '@/types/article';
import axios from 'axios';
import { useMemo } from 'react';

const STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  sent: 'Enviado',
  in_transit: 'En Tránsito',
  received: 'Recibido',
  cancelled: 'Cancelado',
};

const STATUS_OPTIONS: { value: SupplierOrderStatus; label: string; disabled?: boolean }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'sent', label: 'Enviado' },
  { value: 'in_transit', label: 'En Tránsito' },
  { value: 'received', label: 'Recibido' },
  { value: 'cancelled', label: 'Cancelado' },
];

export default function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const canEdit = isAdmin();

  const [trendMonths, setTrendMonths] = useState<number>(12);
  const [articlesData, setArticlesData] = useState<Map<number, Article>>(new Map());
  const [loadingArticles, setLoadingArticles] = useState(false);

  const { data, isLoading } = useSupplierOrder(parseInt(id));
  const updateStatus = useUpdateSupplierOrderStatus();

  const order = data?.data;

  // Load article data with trends when order is loaded
  useEffect(() => {
    if (!order?.items || order.items.length === 0) return;

    const loadArticlesData = async () => {
      setLoadingArticles(true);
      try {
        const articleIds = order.items!.map((item: SupplierOrderItemDto) => item.articleId);
        const response = await axios.get('/api/articles', {
          params: {
            ids: articleIds.join(','),
            includeTrends: 'true',
            includeLastSaleDate: 'true',
            trendMonths: trendMonths,
          }
        });

        const articlesMap = new Map<number, Article>();
        response.data.data.forEach((article: Article) => {
          articlesMap.set(article.id, article);
        });

        setArticlesData(articlesMap);
      } catch (error) {
        console.error('Error loading article data:', error);
      } finally {
        setLoadingArticles(false);
      }
    };

    loadArticlesData();
  }, [order?.items, trendMonths]);

  // Recalcular métricas dinámicamente basado en salesTrend actual
  const itemsWithRecalculatedMetrics = useMemo(() => {
    if (!order?.items || articlesData.size === 0) return order?.items || [];

    return order.items.map((item: SupplierOrderItemDto) => {
      const article = articlesData.get(item.articleId);
      
      if (!article?.salesTrend) {
        return item; // Sin datos, usar valores originales
      }

      // Recalcular con WMA dinámico
      const avgMonthlySales = calculateWeightedAvgSales(article.salesTrend, trendMonths);
      const estimatedSaleTime = calculateEstimatedSaleTime(item.quantity, avgMonthlySales);

      return {
        ...item,
        avgMonthlySales,
        estimatedSaleTime,
      };
    });
  }, [order?.items, articlesData, trendMonths]);

  // Recalcular tiempo estimado total
  const recalculatedTotalEstimatedTime = useMemo(() => {
    if (!itemsWithRecalculatedMetrics || itemsWithRecalculatedMetrics.length === 0) {
      return order?.estimatedSaleTimeMonths || 0;
    }

    const itemsForCalc = itemsWithRecalculatedMetrics.map((item: SupplierOrderItemDto) => ({
      quantity: item.quantity,
      estimatedSaleTime: item.estimatedSaleTime || Infinity,
    }));

    return calculateWeightedAvgSaleTime(itemsForCalc);
  }, [itemsWithRecalculatedMetrics, order?.estimatedSaleTimeMonths]);

  const handleStatusChange = (newStatus: string) => {
    if (!order) return;
    updateStatus.mutate({ id: order.id, status: newStatus as SupplierOrderStatus });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Cargando pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Pedido no encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/supplier-orders')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Pedido {order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Creado el {new Date(order.orderDate).toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>

      {/* Order Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Información del Pedido</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Proveedor</div>
              <div className="font-medium">{order.supplierName || 'Sin asignar'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Estado</div>
              <div>
                {canEdit ? (
                  <Select
                    value={order.status}
                    onValueChange={handleStatusChange}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge>{STATUS_LABELS[order.status as SupplierOrderStatus]}</Badge>
                )}
              </div>
            </div>
            {order.expectedDeliveryDate && (
              <div>
                <div className="text-sm text-muted-foreground">Fecha Entrega Esperada</div>
                <div>{new Date(order.expectedDeliveryDate).toLocaleDateString('es-AR')}</div>
              </div>
            )}
            {order.actualDeliveryDate && (
              <div>
                <div className="text-sm text-muted-foreground">Fecha Entrega Real</div>
                <div>{new Date(order.actualDeliveryDate).toLocaleDateString('es-AR')}</div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Resumen</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Total Artículos</div>
              <div className="text-2xl font-bold">{order.totalItems}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Unidades</div>
              <div className="text-2xl font-bold">{order.totalQuantity}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tiempo Est. Venta</div>
              <div className="text-lg font-semibold">
                {formatSaleTime(recalculatedTotalEstimatedTime)}
              </div>
              {!loadingArticles && articlesData.size > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Calculado con WMA ({trendMonths} meses)
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Artículos del Pedido
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tendencia:</span>
            <Select
              value={trendMonths.toString()}
              onValueChange={(value) => setTrendMonths(parseInt(value))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-right">Stock Mín.</TableHead>
                <TableHead>Tendencia ({trendMonths} meses)</TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Precio Unit.</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Precio unitario del artículo</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Prom Ponderado</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Promedio ponderado de ventas (WMA) sobre los últimos {trendMonths} meses.
                        Da más peso a los meses recientes.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T. Est. Venta</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Tiempo estimado para vender la cantidad pedida = Cantidad / Prom Ponderado
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help">Última Venta</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Fecha de la última factura emitida que incluye este artículo</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingArticles ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Cargando datos de artículos...
                  </TableCell>
                </TableRow>
              ) : (
                itemsWithRecalculatedMetrics.map((item: SupplierOrderItemDto) => {
                  const article = articlesData.get(item.articleId);
                  const isLowStock = item.currentStock < item.minimumStock;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-medium">
                        {item.articleCode}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md truncate">{item.articleDescription}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={isLowStock ? 'text-red-600 font-semibold' : ''}>
                          {item.currentStock.toFixed(0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.minimumStock.toFixed(0)}
                      </TableCell>
                      
                      {/* Tendencia */}
                      <TableCell>
                        {article?.salesTrend && article.salesTrend.length > 0 ? (
                          <SparklineWithTooltip
                            data={article.salesTrend}
                            labels={article.salesTrendLabels}
                            width={Math.min(180, Math.max(80, article.salesTrend.length * 10))}
                            height={40}
                            color={
                              article.abcClass === 'A'
                                ? 'rgb(34, 197, 94)' // green-500
                                : article.abcClass === 'B'
                                ? 'rgb(59, 130, 246)' // blue-500
                                : 'rgb(107, 114, 128)' // gray-500
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin datos</span>
                        )}
                      </TableCell>
                      
                      {/* Precio Unit. */}
                      <TableCell className="text-right font-medium">
                        {article ? formatPrice(article.unitPrice) : '-'}
                      </TableCell>
                      
                      {/* Prom Ponderado */}
                      <TableCell className="text-right">
                        {item.avgMonthlySales && item.avgMonthlySales > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            {item.avgMonthlySales.toFixed(1)}
                          </Badge>
                        ) : article?.salesTrend && article.salesTrend.length > 0 ? (
                          <span className="text-muted-foreground text-xs">0.0</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      
                      {/* T. Est. Venta */}
                      <TableCell className="text-right">
                        {item.estimatedSaleTime ? (
                          <Badge 
                            variant={
                              isFinite(item.estimatedSaleTime) && item.estimatedSaleTime > 0
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {formatSaleTime(item.estimatedSaleTime)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            ∞ Infinito
                          </Badge>
                        )}
                      </TableCell>
                      
                      {/* Última Venta */}
                      <TableCell className="text-sm">
                        {article?.lastSaleDate ? (
                          <span>
                            {new Date(article.lastSaleDate).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nunca</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {order.notes && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Notas</h2>
          <p className="text-muted-foreground">{order.notes}</p>
        </Card>
      )}
    </div>
  );
}


