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
import { SupplierOrderStatus, SupplierOrderItemDto, CommercialValuationConfig } from '@/types/supplierOrder';
import { formatSaleTime, calculateWeightedAvgSales, calculateEstimatedSaleTime, calculateWeightedAvgSaleTime } from '@/lib/utils/salesCalculations';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Article } from '@/types/article';
import axios from 'axios';
import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';

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
  const [showCommercial, setShowCommercial] = useState(false);
  const [commercialConfig, setCommercialConfig] = useState<CommercialValuationConfig>({
    cifPercentage: 50,
    useCategoryDiscounts: true,
  });

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
            includeCategory: 'true',
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

      // Calcular valores comerciales
      const fobUnitPrice = item.proformaUnitPrice || 0;
      const categoryDiscount = commercialConfig.useCategoryDiscounts 
        ? (article.categoryDefaultDiscount || 0) 
        : 0;
      
      const cifUnitPrice = fobUnitPrice * (1 + commercialConfig.cifPercentage / 100);
      const discountedUnitPrice = (item.dbUnitPrice || 0) * (1 - categoryDiscount / 100);
      const discountedTotalPrice = discountedUnitPrice * item.quantity;
      
      const realMarginAbsolute = discountedUnitPrice - cifUnitPrice;
      // Margen sobre costo CIF (markup): (Venta - Costo) / Costo × 100
      const realMarginPercent = cifUnitPrice > 0 
        ? (realMarginAbsolute / cifUnitPrice) * 100 
        : 0;

      return {
        ...item,
        avgMonthlySales,
        estimatedSaleTime,
        // Commercial data
        categoryId: article.categoryId,
        categoryName: article.categoryName,
        categoryDiscount,
        cifPercentage: commercialConfig.cifPercentage,
        cifUnitPrice,
        discountedUnitPrice,
        discountedTotalPrice,
        realMarginAbsolute,
        realMarginPercent,
      };
    });
  }, [order?.items, articlesData, trendMonths, commercialConfig]);

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

      {/* Valorización Cards - Mismo formato que modal de importación */}
      {order.items?.some((item: SupplierOrderItemDto) => item.proformaTotalPrice) && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                ${order.items.reduce((sum: number, item: SupplierOrderItemDto) => sum + (item.proformaTotalPrice || 0), 0).toFixed(2)}
              </div>
              <div className="text-sm text-blue-600">Total Proforma (FOB)</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                ${order.items.reduce((sum: number, item: SupplierOrderItemDto) => sum + (item.dbTotalPrice || 0), 0).toFixed(2)}
              </div>
              <div className="text-sm text-purple-600">Total DB (sin desc.)</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              {(() => {
                const totalProforma = order.items.reduce((sum: number, item: SupplierOrderItemDto) => sum + (item.proformaTotalPrice || 0), 0);
                const totalDB = order.items.reduce((sum: number, item: SupplierOrderItemDto) => sum + (item.dbTotalPrice || 0), 0);
                const margin = totalDB - totalProforma;
                const marginPercent = totalProforma > 0 ? ((totalDB / totalProforma - 1) * 100) : 0;
                
                return (
                  <>
                    <div className="text-2xl font-bold text-green-700">
                      ${margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                    </div>
                    <div className="text-sm text-green-600">Margen DB</div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Commercial Valuation Config & Cards */}
          <div className="space-y-3 p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="show-commercial-detail" className="text-sm font-medium cursor-pointer">
                  Mostrar análisis comercial (CIF + Descuentos)
                </Label>
              </div>
              <Switch
                id="show-commercial-detail"
                checked={showCommercial}
                onCheckedChange={setShowCommercial}
              />
            </div>
            
            {showCommercial && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="cif-percentage-detail" className="text-xs">
                      CIF sobre FOB (%)
                    </Label>
                    <Select
                      value={commercialConfig.cifPercentage.toString()}
                      onValueChange={(v) =>
                        setCommercialConfig({
                          ...commercialConfig,
                          cifPercentage: parseInt(v),
                        })
                      }
                    >
                      <SelectTrigger id="cif-percentage-detail" className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30%</SelectItem>
                        <SelectItem value="40">40%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="60">60%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="use-category-discounts-detail" className="text-xs flex items-center gap-1">
                      Aplicar descuentos de categoría
                    </Label>
                    <div className="flex items-center h-8 px-3 border rounded-md">
                      <Switch
                        id="use-category-discounts-detail"
                        checked={commercialConfig.useCategoryDiscounts}
                        onCheckedChange={(checked) =>
                          setCommercialConfig({
                            ...commercialConfig,
                            useCategoryDiscounts: checked,
                          })
                        }
                      />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {commercialConfig.useCategoryDiscounts ? 'Activado' : 'Desactivado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Commercial Cards */}
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-2xl font-bold text-orange-700">
                      ${itemsWithRecalculatedMetrics.reduce((sum: number, item: any) => {
                        const cifTotal = (item.cifUnitPrice || 0) * item.quantity;
                        return sum + cifTotal;
                      }, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-orange-600">Total CIF ({commercialConfig.cifPercentage}%)</div>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <div className="text-2xl font-bold text-cyan-700">
                      ${itemsWithRecalculatedMetrics.reduce((sum: number, item: any) => sum + (item.discountedTotalPrice || 0), 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-cyan-600">Total c/Descuentos</div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    {(() => {
                      const totalCIF = itemsWithRecalculatedMetrics.reduce((sum: number, item: any) => {
                        const cifTotal = (item.cifUnitPrice || 0) * item.quantity;
                        return sum + cifTotal;
                      }, 0);
                      const totalDiscounted = itemsWithRecalculatedMetrics.reduce((sum: number, item: any) => sum + (item.discountedTotalPrice || 0), 0);
                      const realMargin = totalDiscounted - totalCIF;
                      // Margen sobre costo (markup): (Venta - Costo) / Costo × 100
                      const realMarginPercent = totalCIF > 0 ? (realMargin / totalCIF) * 100 : 0;
                      
                      return (
                        <>
                          <div className={`text-2xl font-bold ${realMarginPercent >= 100 ? 'text-emerald-700' : realMarginPercent >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            ${realMargin.toFixed(2)} ({realMarginPercent.toFixed(1)}%)
                          </div>
                          <div className="text-sm text-emerald-600">Margen Real</div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

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
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Stock Mín.</TableHead>
                  <TableHead>Tendencia ({trendMonths} meses)</TableHead>
                  <TableHead className="text-right">Peso Unit.</TableHead>
                  <TableHead className="text-right">P.U. Proforma</TableHead>
                  <TableHead className="text-right">Total Proforma</TableHead>
                  <TableHead className="text-right">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Precio Unit.
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Precio unitario del artículo en BD</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right">Total DB</TableHead>
                  <TableHead className="text-right">Margen USD</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                  <TableHead className="text-right">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Prom Ponderado
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Promedio ponderado de ventas (WMA) sobre los últimos {trendMonths} meses.
                          Da más peso a los meses recientes.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        T. Est. Venta
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Tiempo estimado para vender la cantidad pedida = Cantidad / Prom Ponderado
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Última Venta
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Fecha de la última factura emitida que incluye este artículo</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  {showCommercial && (
                    <>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            Desc. %
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Descuento de categoría aplicado</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            CIF Unit.
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">FOB + {commercialConfig.cifPercentage}% = Costo real de importación</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            Total CIF
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">CIF Unit. × Cantidad = Costo total de importación</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            Precio c/Desc
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Precio DB con descuento de categoría aplicado</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            Total c/Desc
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Total con descuento aplicado</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            Margen Real USD
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Total c/Desc - Total CIF</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            Margen Real %
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">(Margen Real USD / Total CIF) × 100<br/>Markup sobre costo de importación</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingArticles ? (
                  <TableRow>
                    <TableCell colSpan={showCommercial ? 25 : 17} className="text-center text-muted-foreground py-8">
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
                      
                      {/* Peso Unit. */}
                      <TableCell className="text-right text-sm">
                        {item.unitWeight ? `${item.unitWeight.toFixed(2)} kg` : '-'}
                      </TableCell>
                      
                      {/* P.U. Proforma */}
                      <TableCell className="text-right font-medium">
                        {item.proformaUnitPrice ? formatPrice(item.proformaUnitPrice) : '-'}
                      </TableCell>
                      
                      {/* Total Proforma */}
                      <TableCell className="text-right font-medium">
                        {item.proformaTotalPrice ? formatPrice(item.proformaTotalPrice) : '-'}
                      </TableCell>
                      
                      {/* Precio Unit. DB */}
                      <TableCell className="text-right font-medium">
                        {item.dbUnitPrice ? formatPrice(item.dbUnitPrice) : (article ? formatPrice(article.unitPrice) : '-')}
                      </TableCell>
                      
                      {/* Total DB */}
                      <TableCell className="text-right font-medium">
                        {item.dbTotalPrice ? formatPrice(item.dbTotalPrice) : '-'}
                      </TableCell>
                      
                      {/* Margen USD */}
                      <TableCell className={`text-right font-semibold ${
                        item.marginAbsolute && item.marginAbsolute > 0 
                          ? 'text-green-600' 
                          : item.marginAbsolute && item.marginAbsolute < 0 
                          ? 'text-red-600' 
                          : ''
                      }`}>
                        {item.marginAbsolute ? formatPrice(item.marginAbsolute) : '-'}
                      </TableCell>
                      
                      {/* Margen % */}
                      <TableCell className={`text-right font-semibold ${
                        item.marginPercent && item.marginPercent > 0 
                          ? 'text-green-600' 
                          : item.marginPercent && item.marginPercent < 0 
                          ? 'text-red-600' 
                          : ''
                      }`}>
                        {item.marginPercent ? `${item.marginPercent.toFixed(1)}%` : '-'}
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

                      {/* Commercial Columns */}
                      {showCommercial && (
                        <>
                          {/* Categoría */}
                          <TableCell className="text-xs text-muted-foreground">
                            {(item as any).categoryName || '-'}
                          </TableCell>
                          
                          {/* Descuento % */}
                          <TableCell className="text-right text-xs">
                            {(item as any).categoryDiscount !== undefined ? (
                              <span className="text-orange-600 font-medium">
                                {(item as any).categoryDiscount.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* CIF Unitario */}
                          <TableCell className="text-right text-sm font-medium">
                            {(item as any).cifUnitPrice !== undefined ? (
                              formatPrice((item as any).cifUnitPrice)
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Total CIF */}
                          <TableCell className="text-right text-sm font-semibold">
                            {(item as any).cifUnitPrice !== undefined ? (
                              <span className="text-orange-700">
                                {formatPrice((item as any).cifUnitPrice * item.quantity)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Precio con Descuento */}
                          <TableCell className="text-right text-sm font-semibold">
                            {(item as any).discountedUnitPrice !== undefined ? (
                              <span className="text-cyan-600">
                                {formatPrice((item as any).discountedUnitPrice)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Total con Descuento */}
                          <TableCell className="text-right text-sm font-semibold">
                            {(item as any).discountedTotalPrice !== undefined ? (
                              <span className="text-cyan-700">
                                {formatPrice((item as any).discountedTotalPrice)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Margen Real USD */}
                          <TableCell className="text-right text-sm font-bold">
                            {(item as any).discountedTotalPrice !== undefined && (item as any).cifUnitPrice !== undefined ? (
                              (() => {
                                const totalCIF = (item as any).cifUnitPrice * item.quantity;
                                const marginUSD = (item as any).discountedTotalPrice - totalCIF;
                                const marginPercent = totalCIF > 0 
                                  ? (marginUSD / totalCIF) * 100 
                                  : 0;
                                
                                return (
                                  <span
                                    className={
                                      marginPercent >= 100
                                        ? 'text-green-600'
                                        : marginPercent >= 50
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {formatPrice(marginUSD)}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Margen Real % */}
                          <TableCell className="text-right text-sm font-bold">
                            {(item as any).realMarginPercent !== undefined ? (
                              <span
                                className={
                                  (item as any).realMarginPercent >= 100
                                    ? 'text-green-600'
                                    : (item as any).realMarginPercent >= 50
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }
                              >
                                {(item as any).realMarginPercent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
                </TableBody>
            </Table>
          </TooltipProvider>
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


