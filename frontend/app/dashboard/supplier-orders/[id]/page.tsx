'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Download, RefreshCw } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useSupplierOrder, useUpdateSupplierOrderStatus } from '@/lib/hooks/useSupplierOrders';
import { useAuthStore } from '@/store/authStore';
import { SupplierOrderStatus, SupplierOrderItemDto, CommercialValuationConfig } from '@/types/supplierOrder';
import { formatSaleTime, calculateWeightedAvgSales, calculateEstimatedSaleTime, calculateWeightedAvgSaleTime } from '@/lib/utils/salesCalculations';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Article } from '@/types/article';
import axios from 'axios';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';

// Extender SupplierOrderItemDto con propiedades comerciales calculadas
interface ItemWithCommercialMetrics extends SupplierOrderItemDto {
  categoryId?: number | null;
  categoryName?: string | null;
  categoryDiscount?: number;
  cifPercentage?: number;
  cifUnitPrice?: number;
  discountedUnitPrice?: number;
  discountedTotalPrice?: number;
  realMarginAbsolute?: number;
  realMarginPercent?: number;
}

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
  const [discountOverrides, setDiscountOverrides] = useState<Map<number, number>>(new Map());
  const [globalDiscount, setGlobalDiscount] = useState<string>('');
  const [syncingWeights, setSyncingWeights] = useState(false);

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
  const itemsWithRecalculatedMetrics = useMemo((): ItemWithCommercialMetrics[] => {
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
      
      // Usar descuento sobreescrito si existe, sino usar el de categoría
      const overriddenDiscount = discountOverrides.get(item.articleId);
      const categoryDiscount = overriddenDiscount !== undefined
        ? overriddenDiscount
        : (commercialConfig.useCategoryDiscounts ? (article.categoryDefaultDiscount || 0) : 0);
      
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
  }, [order?.items, articlesData, trendMonths, commercialConfig, discountOverrides]);

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

  const handleDiscountChange = (articleId: number, newDiscount: number) => {
    setDiscountOverrides((prev) => {
      const updated = new Map(prev);
      updated.set(articleId, newDiscount);
      return updated;
    });
  };

  const handleApplyGlobalDiscount = () => {
    const discount = parseFloat(globalDiscount);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      return;
    }

    if (!order?.items) return;

    const updated = new Map<number, number>();
    order.items.forEach((item: SupplierOrderItemDto) => {
      updated.set(item.articleId, discount);
    });
    
    setDiscountOverrides(updated);
    setGlobalDiscount('');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  const handleSyncWeights = async () => {
    if (!order || !confirm('¿Sincronizar los datos de esta proforma a los artículos? Esto actualizará el peso (kg), el último precio de compra y el % CIF de cada artículo.')) {
      return;
    }

    setSyncingWeights(true);
    try {
      const response = await axios.post(`/api/supplier-orders/${order.id}/sync-data`, {
        cifPercentage: commercialConfig.cifPercentage,
      });
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
      } else {
        alert('Error: ' + (response.data.error || 'Error desconocido'));
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      console.error('Error syncing data:', error);
      alert('Error al sincronizar datos: ' + (axiosError.response?.data?.error || 'Error de conexión'));
    } finally {
      setSyncingWeights(false);
    }
  };

  const handleExportToHTML = () => {
    if (!order) return;

    // Calcular totales
    const totalProforma = order.items.reduce((sum: number, item: SupplierOrderItemDto) => sum + (item.proformaTotalPrice || 0), 0);
    const totalDB = order.items.reduce((sum: number, item: SupplierOrderItemDto) => sum + (item.dbTotalPrice || 0), 0);
    const marginDB = totalDB - totalProforma;
    const marginDBPercent = totalProforma > 0 ? ((totalDB / totalProforma - 1) * 100) : 0;

    const totalCIF = itemsWithRecalculatedMetrics.reduce((sum: number, item: ItemWithCommercialMetrics) => {
      const cifTotal = (item.cifUnitPrice || 0) * item.quantity;
      return sum + cifTotal;
    }, 0);
    const totalDiscounted = itemsWithRecalculatedMetrics.reduce((sum: number, item: ItemWithCommercialMetrics) => sum + (item.discountedTotalPrice || 0), 0);
    const realMargin = totalDiscounted - totalCIF;
    const realMarginPercent = totalCIF > 0 ? (realMargin / totalCIF) * 100 : 0;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido ${order.orderNumber} - Análisis Comercial</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .container { 
      max-width: 100%;
      background: white;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-radius: 8px;
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 { 
      color: #1e293b;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .info-item {
      padding: 12px;
      background: #f8fafc;
      border-left: 3px solid #94a3b8;
      border-radius: 4px;
    }
    .info-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      color: #1e293b;
      font-weight: 500;
    }
    .totals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .total-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .total-card.blue { background: #eff6ff; border: 2px solid #3b82f6; }
    .total-card.purple { background: #f5f3ff; border: 2px solid #a855f7; }
    .total-card.green { background: #f0fdf4; border: 2px solid #22c55e; }
    .total-card.orange { background: #fff7ed; border: 2px solid #f97316; }
    .total-card.cyan { background: #ecfeff; border: 2px solid #06b6d4; }
    .total-card.emerald { background: #ecfdf5; border: 2px solid #10b981; }
    .total-value {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .total-card.blue .total-value { color: #1d4ed8; }
    .total-card.purple .total-value { color: #7c3aed; }
    .total-card.green .total-value { color: #16a34a; }
    .total-card.orange .total-value { color: #c2410c; }
    .total-card.cyan .total-value { color: #0e7490; }
    .total-card.emerald .total-value { color: #059669; }
    .total-label {
      font-size: 13px;
      font-weight: 600;
      opacity: 0.8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 12px;
    }
    th {
      background: #1e293b;
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th.text-right { text-align: right; }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    td.text-right { text-align: right; }
    tr:hover { background: #f8fafc; }
    .commercial-section {
      margin-top: 30px;
      padding-top: 30px;
      border-top: 2px dashed #cbd5e1;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.orange { background: #fed7aa; color: #9a3412; }
    .badge.cyan { background: #a5f3fc; color: #0e7490; }
    .badge.green { background: #bbf7d0; color: #166534; }
    .badge.yellow { background: #fef08a; color: #854d0e; }
    .badge.red { background: #fecaca; color: #991b1b; }
    .highlight { background: #fef3c7; font-weight: 600; }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 12px;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Pedido ${order.orderNumber}</h1>
      <p style="color: #64748b; font-size: 14px;">
        ${order.supplierName || 'Sin proveedor'} | 
        Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Estado</div>
        <div class="info-value">${STATUS_LABELS[order.status as SupplierOrderStatus]}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Fecha de Pedido</div>
        <div class="info-value">${new Date(order.orderDate).toLocaleDateString('es-AR')}</div>
      </div>
      ${order.expectedDeliveryDate ? `
      <div class="info-item">
        <div class="info-label">Fecha Entrega Esperada</div>
        <div class="info-value">${new Date(order.expectedDeliveryDate).toLocaleDateString('es-AR')}</div>
      </div>` : ''}
      <div class="info-item">
        <div class="info-label">Total Artículos</div>
        <div class="info-value">${order.totalItems}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Total Unidades</div>
        <div class="info-value">${order.totalQuantity}</div>
      </div>
    </div>

    <h2 class="section-title">💰 Valorización Estándar</h2>
    <div class="totals-grid">
      <div class="total-card blue">
        <div class="total-value">${formatPrice(totalProforma)}</div>
        <div class="total-label">Total Proforma (FOB)</div>
      </div>
      <div class="total-card purple">
        <div class="total-value">${formatPrice(totalDB)}</div>
        <div class="total-label">Total DB (sin desc.)</div>
      </div>
      <div class="total-card green">
        <div class="total-value">${formatPrice(marginDB)} (${marginDBPercent.toFixed(1)}%)</div>
        <div class="total-label">Margen DB</div>
      </div>
    </div>

    ${showCommercial ? `
    <div class="commercial-section">
      <h2 class="section-title">🎯 Análisis Comercial (CIF ${commercialConfig.cifPercentage}% + Descuentos)</h2>
      <div class="totals-grid">
        <div class="total-card orange">
          <div class="total-value">${formatPrice(totalCIF)}</div>
          <div class="total-label">Total CIF (${commercialConfig.cifPercentage}%)</div>
        </div>
        <div class="total-card cyan">
          <div class="total-value">${formatPrice(totalDiscounted)}</div>
          <div class="total-label">Total c/Descuentos</div>
        </div>
        <div class="total-card emerald">
          <div class="total-value" style="color: ${realMarginPercent >= 100 ? '#059669' : realMarginPercent >= 50 ? '#ca8a04' : '#dc2626'}">
            ${formatPrice(realMargin)} (${realMarginPercent.toFixed(1)}%)
          </div>
          <div class="total-label">Margen Real (Markup sobre CIF)</div>
        </div>
      </div>
    </div>
    ` : ''}

    <h2 class="section-title">📋 Detalle de Artículos</h2>
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th class="text-right">Cantidad</th>
          <th class="text-right">Stock Actual</th>
          <th class="text-right">Stock Mín.</th>
          <th class="text-right">Peso Unit.</th>
          <th class="text-right">P.U. Proforma</th>
          <th class="text-right">Total Proforma</th>
          <th class="text-right">Precio Unit. DB</th>
          <th class="text-right">Total DB</th>
          ${showCommercial ? `
          <th>Categoría</th>
          <th class="text-right">Desc. %</th>
          <th class="text-right">CIF Unit.</th>
          <th class="text-right">Total CIF</th>
          <th class="text-right">Precio c/Desc</th>
          <th class="text-right">Total c/Desc</th>
          <th class="text-right">Margen Real USD</th>
          <th class="text-right">Margen Real %</th>
          ` : ''}
        </tr>
      </thead>
      <tbody>
        ${itemsWithRecalculatedMetrics.map((item: ItemWithCommercialMetrics) => {
          const article = articlesData.get(item.articleId);
          const totalCIFItem = (item.cifUnitPrice || 0) * item.quantity;
          const marginRealUSD = (item.discountedTotalPrice || 0) - totalCIFItem;
          const marginRealPercent = totalCIFItem > 0 ? (marginRealUSD / totalCIFItem) * 100 : 0;
          
          return `
          <tr>
            <td><strong>${item.articleCode}</strong></td>
            <td>${item.articleDescription}</td>
            <td class="text-right"><strong>${item.quantity}</strong></td>
            <td class="text-right">${item.currentStock}</td>
            <td class="text-right">${item.minimumStock}</td>
            <td class="text-right">${item.unitWeight ? item.unitWeight.toFixed(2) + ' kg' : '-'}</td>
            <td class="text-right">${item.proformaUnitPrice ? formatPrice(item.proformaUnitPrice) : '-'}</td>
            <td class="text-right"><strong>${item.proformaTotalPrice ? formatPrice(item.proformaTotalPrice) : '-'}</strong></td>
            <td class="text-right">${item.dbUnitPrice ? formatPrice(item.dbUnitPrice) : (article ? formatPrice(article.unitPrice) : '-')}</td>
            <td class="text-right"><strong>${item.dbTotalPrice ? formatPrice(item.dbTotalPrice) : '-'}</strong></td>
            ${showCommercial ? `
            <td><small>${item.categoryName || '-'}</small></td>
            <td class="text-right ${discountOverrides.has(item.articleId) ? 'highlight' : ''}">
              <span class="badge orange">${item.categoryDiscount?.toFixed(0) || '0'}%</span>
            </td>
            <td class="text-right">${item.cifUnitPrice ? formatPrice(item.cifUnitPrice) : '-'}</td>
            <td class="text-right"><strong style="color: #c2410c">${formatPrice(totalCIFItem)}</strong></td>
            <td class="text-right"><strong style="color: #0e7490">${item.discountedUnitPrice ? formatPrice(item.discountedUnitPrice) : '-'}</strong></td>
            <td class="text-right"><strong style="color: #0e7490">${item.discountedTotalPrice ? formatPrice(item.discountedTotalPrice) : '-'}</strong></td>
            <td class="text-right">
              <strong style="color: ${marginRealPercent >= 100 ? '#16a34a' : marginRealPercent >= 50 ? '#ca8a04' : '#dc2626'}">
                ${formatPrice(marginRealUSD)}
              </strong>
            </td>
            <td class="text-right">
              <span class="badge ${marginRealPercent >= 100 ? 'green' : marginRealPercent >= 50 ? 'yellow' : 'red'}">
                ${marginRealPercent.toFixed(1)}%
              </span>
            </td>
            ` : ''}
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    ${discountOverrides.size > 0 ? `
    <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <strong>⚠️ Descuentos personalizados:</strong> ${discountOverrides.size} artículo(s) con descuento modificado manualmente (resaltados en amarillo).
    </div>
    ` : ''}

    <div class="footer">
      <p><strong>Sistema de Gestión DIALFA</strong></p>
      <p>Documento generado automáticamente el ${new Date().toLocaleString('es-AR')}</p>
    </div>
  </div>
</body>
</html>
    `;

    // Crear y descargar el archivo
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pedido_${order.orderNumber}_Analisis_Comercial_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <Button
          variant="outline"
          onClick={handleSyncWeights}
          disabled={syncingWeights || !canEdit}
          className="gap-2"
          title="Actualizar el peso (kg), el último precio de compra y el % CIF de cada artículo con los datos de esta proforma"
        >
          <RefreshCw className="h-4 w-4" />
          {syncingWeights ? 'Sincronizando...' : 'Sincronizar Datos'}
        </Button>
        <Button
          variant="outline"
          onClick={handleExportToHTML}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Descargar HTML
        </Button>
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

                {/* Global Discount Override */}
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="global-discount" className="text-xs font-semibold text-orange-700">
                    Aplicar descuento global a todos los artículos
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="global-discount"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="Ej: 25"
                      value={globalDiscount}
                      onChange={(e) => setGlobalDiscount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleApplyGlobalDiscount();
                        }
                      }}
                      className="h-8 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleApplyGlobalDiscount}
                      disabled={!globalDiscount || isNaN(parseFloat(globalDiscount))}
                      className="h-8"
                    >
                      Aplicar a todos
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Esto sobreescribirá los descuentos de categoría para todos los artículos del pedido
                  </p>
                </div>

                {/* Reset Overrides Button */}
                {discountOverrides.size > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {discountOverrides.size} descuento{discountOverrides.size !== 1 ? 's' : ''} personalizado{discountOverrides.size !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDiscountOverrides(new Map())}
                      className="h-7 text-xs"
                    >
                      Resetear descuentos
                    </Button>
                  </div>
                )}

                {/* Commercial Cards */}
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-2xl font-bold text-orange-700">
                      ${itemsWithRecalculatedMetrics.reduce((sum: number, item: ItemWithCommercialMetrics) => {
                        const cifTotal = (item.cifUnitPrice || 0) * item.quantity;
                        return sum + cifTotal;
                      }, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-orange-600">Total CIF ({commercialConfig.cifPercentage}%)</div>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <div className="text-2xl font-bold text-cyan-700">
                      ${itemsWithRecalculatedMetrics.reduce((sum: number, item: ItemWithCommercialMetrics) => sum + (item.discountedTotalPrice || 0), 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-cyan-600">Total c/Descuentos</div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    {(() => {
                      const totalCIF = itemsWithRecalculatedMetrics.reduce((sum: number, item: ItemWithCommercialMetrics) => {
                        const cifTotal = (item.cifUnitPrice || 0) * item.quantity;
                        return sum + cifTotal;
                      }, 0);
                      const totalDiscounted = itemsWithRecalculatedMetrics.reduce((sum: number, item: ItemWithCommercialMetrics) => sum + (item.discountedTotalPrice || 0), 0);
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
                            Desc. % ✏️
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Descuento de categoría (editable). Haz clic para personalizar por artículo.</p>
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
                  itemsWithRecalculatedMetrics.map((item: ItemWithCommercialMetrics) => {
                    const article = articlesData.get(item.articleId);
                    
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
                          {item.currentStock}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.minimumStock}
                        </TableCell>
                        
                        {/* Tendencia */}
                        <TableCell>
                          {article?.salesTrend && article.salesTrend.length > 0 ? (
                            <SparklineWithTooltip
                              data={article.salesTrend.slice(-trendMonths)}
                              width={120}
                              height={30}
                              className="inline-block"
                              color={
                                article.abcClass === 'A'
                                  ? 'rgb(34, 197, 94)' // green-500
                                  : article.abcClass === 'B'
                                  ? 'rgb(59, 130, 246)' // blue-500
                                  : 'rgb(107, 114, 128)' // gray-500
                              }
                              labels={article.salesTrend
                                .slice(-trendMonths)
                                .map((_, idx) => {
                                  const date = new Date();
                                  date.setMonth(date.getMonth() - (trendMonths - idx - 1));
                                  return date.toLocaleDateString('es-AR', {
                                    month: 'short',
                                    year: '2-digit',
                                  });
                                })
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
                              {item.categoryName || '-'}
                            </TableCell>
                            
                            {/* Descuento % - Editable */}
                            <TableCell className="text-right">
                              {item.categoryDiscount !== undefined ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={item.categoryDiscount.toFixed(0)}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value);
                                      if (!isNaN(value) && value >= 0 && value <= 100) {
                                        handleDiscountChange(item.articleId, value);
                                      }
                                    }}
                                    className={`w-16 h-7 text-right text-xs font-medium border-orange-200 focus:border-orange-400 ${
                                      discountOverrides.has(item.articleId) 
                                        ? 'text-orange-700 bg-orange-50 font-bold' 
                                        : 'text-orange-600'
                                    }`}
                                    title={discountOverrides.has(item.articleId) ? 'Descuento personalizado' : 'Descuento de categoría'}
                                  />
                                  <span className="text-xs text-orange-600">%</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            {/* CIF Unitario */}
                            <TableCell className="text-right text-sm font-medium">
                              {item.cifUnitPrice !== undefined ? (
                                formatPrice(item.cifUnitPrice)
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            {/* Total CIF */}
                            <TableCell className="text-right text-sm font-semibold">
                              {item.cifUnitPrice !== undefined ? (
                                <span className="text-orange-700">
                                  {formatPrice(item.cifUnitPrice * item.quantity)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            {/* Precio con Descuento */}
                            <TableCell className="text-right text-sm font-semibold">
                              {item.discountedUnitPrice !== undefined ? (
                                <span className="text-cyan-600">
                                  {formatPrice(item.discountedUnitPrice)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            {/* Total con Descuento */}
                            <TableCell className="text-right text-sm font-semibold">
                              {item.discountedTotalPrice !== undefined ? (
                                <span className="text-cyan-700">
                                  {formatPrice(item.discountedTotalPrice)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            
                            {/* Margen Real USD */}
                            <TableCell className="text-right text-sm font-bold">
                              {item.discountedTotalPrice !== undefined && item.cifUnitPrice !== undefined ? (
                                (() => {
                                  const totalCIF = item.cifUnitPrice * item.quantity;
                                  const marginUSD = item.discountedTotalPrice - totalCIF;
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
                              {item.realMarginPercent !== undefined ? (
                                <span
                                  className={
                                    item.realMarginPercent >= 100
                                      ? 'text-green-600'
                                      : item.realMarginPercent >= 50
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                  }
                                >
                                  {item.realMarginPercent.toFixed(1)}%
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

