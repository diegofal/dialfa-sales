'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { usePriceLists, useUpdatePrices } from '@/lib/hooks/usePriceLists';
import { useCategories } from '@/lib/hooks/useCategories';
import { useAuthStore } from '@/store/authStore';
import { PriceListFilters } from '@/components/priceLists/PriceListFilters';
import { PriceListTable } from '@/components/priceLists/PriceListTable';
import { PriceHistoryTable } from '@/components/priceLists/PriceHistoryTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AlertCircle, Save, X, DollarSign, Download, Upload, History, List } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BulkPriceUpdate } from '@/types/priceList';
import { sortArticlesByCategory } from '@/lib/utils/articleSorting';
import { toast } from 'sonner';
import { PriceImportDialog } from '@/components/priceLists/PriceImportDialog';

export default function PriceListsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useAuthStore();
  
  // Get initial tab from URL or default to 'price-lists'
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return searchParams.get('tab') || 'price-lists';
  });

  // Sync tab with URL on mount and when searchParams change
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'price-lists';
    if (tabFromUrl !== currentTab) {
      setCurrentTab(tabFromUrl);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setCurrentTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`);
  };
  
  // State - DEBE estar antes del early return
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [editingPrices, setEditingPrices] = useState<Map<number, number>>(new Map());
  const [proposedPrices, setProposedPrices] = useState<Map<number, number>>(new Map()); // Precios del CSV
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Queries - DEBEN estar antes del early return
  const { data: categoriesData } = useCategories({ activeOnly: true, pageSize: 500 });
  
  // Debug: Ver qué categorías está trayendo
  useEffect(() => {
    if (categoriesData?.data) {
      console.log('Categorías cargadas:', categoriesData.data.map(c => ({ code: c.code, name: c.name })));
    }
  }, [categoriesData]);
  
  const { data, isLoading } = usePriceLists({
    categoryId: selectedCategoryId !== 'all' ? parseInt(selectedCategoryId) : undefined,
    search: searchTerm || undefined,
    activeOnly,
  });
  const updatePricesMutation = useUpdatePrices();
  
  // Verificar permisos DESPUÉS de los hooks
  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para acceder a esta página. Solo los administradores pueden ver y editar listas de precios.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handlers
  const handlePriceChange = (articleId: number, newPrice: number) => {
    setEditingPrices((prev) => {
      const updated = new Map(prev);
      updated.set(articleId, newPrice);
      return updated;
    });
  };

  const handleSaveChanges = async () => {
    if (editingPrices.size === 0) {
      toast.warning('No hay cambios para guardar');
      return;
    }

    const updates: BulkPriceUpdate[] = Array.from(editingPrices.entries()).map(
      ([articleId, newPrice]) => ({
        articleId,
        newPrice,
      })
    );

    try {
      await updatePricesMutation.mutateAsync({
        updates,
        changeType: 'manual',
        notes: 'Actualización manual desde interfaz',
      });
      setEditingPrices(new Map());
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const handleDiscardChanges = () => {
    setEditingPrices(new Map());
    toast.info('Cambios descartados');
  };

  const handleImportConfirm = async (updates: Array<{ articleId: number; newPrice: number }>) => {
    // Guardar los precios propuestos sin aplicarlos inmediatamente
    const newProposedPrices = new Map<number, number>();
    updates.forEach(update => {
      newProposedPrices.set(update.articleId, update.newPrice);
    });
    setProposedPrices(newProposedPrices);
    toast.success(`${updates.length} precios preparados. Revisa y confirma los cambios.`);
  };

  const handleConfirmProposedPrices = async () => {
    if (proposedPrices.size === 0) {
      toast.warning('No hay precios propuestos para confirmar');
      return;
    }

    const updates = Array.from(proposedPrices.entries()).map(([articleId, newPrice]) => ({
      articleId,
      newPrice,
    }));

    try {
      await updatePricesMutation.mutateAsync({
        updates,
        changeType: 'csv_import',
        notes: 'Importación masiva desde CSV',
      });
      setProposedPrices(new Map()); // Limpiar precios propuestos
      toast.success('Precios actualizados exitosamente');
    } catch (error) {
      // Error ya manejado
    }
  };

  const handleCancelProposedPrices = () => {
    setProposedPrices(new Map());
    toast.info('Precios propuestos cancelados');
  };

  // Crear array plano de todos los artículos para el import con payment discounts
  const allArticles = data?.data.flatMap(category => 
    category.items.map(item => ({
      id: item.id,
      code: item.code,
      description: item.description,
      unitPrice: item.unitPrice,
      stock: item.stock,
      costPrice: item.costPrice,
      cifPercentage: item.cifPercentage,
      categoryId: item.categoryId,
      paymentDiscounts: category.paymentDiscounts,
    }))
  ) || [];

  // Obtener todos los payment terms únicos
  const allPaymentTerms = data?.data
    .flatMap(category => category.paymentDiscounts)
    .filter((discount, index, self) => 
      index === self.findIndex(d => d.paymentTermId === discount.paymentTermId)
    )
    .sort((a, b) => a.paymentTermCode.localeCompare(b.paymentTermCode))
    || [];

  // Ordenar items usando el algoritmo global de ordenamiento
  // Ver: lib/utils/articleSorting.ts para documentación completa
  const sortedData = data ? sortArticlesByCategory(data.data) : [];

  // Calcular stock valorizado por condición de pago SOLO para items modificados
  const calculateStockValue = () => {
    if (!data || proposedPrices.size === 0) return { before: {}, after: {} };
    
    const beforeByPaymentTerm: Record<string, number> = {};
    const afterByPaymentTerm: Record<string, number> = {};
    
    // Inicializar con todos los payment terms
    allPaymentTerms.forEach(pt => {
      beforeByPaymentTerm[pt.paymentTermCode] = 0;
      afterByPaymentTerm[pt.paymentTermCode] = 0;
    });
    
    // Iterar solo sobre los items que tienen precio propuesto
    sortedData.forEach(category => {
      category.items.forEach(item => {
        const proposedPrice = proposedPrices.get(item.id);
        
        // SOLO calcular si este item tiene un precio propuesto
        if (!proposedPrice) return;
        
        const basePrice = item.unitPrice;
        
        // Calcular valorización por cada payment term
        category.paymentDiscounts.forEach(pd => {
          const currentPrice = basePrice * (1 - pd.discountPercent / 100);
          const newPrice = proposedPrice * (1 - pd.discountPercent / 100);
          
          beforeByPaymentTerm[pd.paymentTermCode] += item.stock * currentPrice;
          afterByPaymentTerm[pd.paymentTermCode] += item.stock * newPrice;
        });
      });
    });
    
    return { before: beforeByPaymentTerm, after: afterByPaymentTerm };
  };

  const stockValue = calculateStockValue();

  // Filtrar datos: Si hay precios propuestos, mostrar solo items modificados
  const displayData = proposedPrices.size > 0
    ? sortedData
        .map(category => ({
          ...category,
          items: category.items.filter(item => proposedPrices.has(item.id)),
        }))
        .filter(category => category.items.length > 0) // Solo categorías con items modificados
    : sortedData;

  const handleDownloadHTML = () => {
    if (!data || displayData.length === 0) {
      toast.error('No hay datos para descargar');
      return;
    }

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lista de Precios - SPISA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px; 
      background: #f5f5f5;
      color: #333;
    }
    .header {
      background: #1a1a1a;
      color: white;
      padding: 30px;
      margin-bottom: 30px;
      border-radius: 8px;
    }
    .header h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }
    .header p {
      color: #aaa;
      font-size: 14px;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat {
      background: white;
      padding: 15px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .category {
      background: white;
      margin-bottom: 30px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .category-header {
      background: #2563eb;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .category-title {
      font-size: 20px;
      font-weight: bold;
    }
    .category-code {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    .category-count {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead {
      background: #f8f9fa;
    }
    th {
      text-align: left;
      padding: 12px 20px;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      font-weight: 600;
    }
    th.price { text-align: right; }
    td {
      padding: 12px 20px;
      border-bottom: 1px solid #f0f0f0;
    }
    td.price {
      text-align: right;
      font-weight: bold;
      color: #2563eb;
      font-size: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-active {
      background: #dcfce7;
      color: #166534;
    }
    .badge-inactive {
      background: #f3f4f6;
      color: #6b7280;
    }
    .badge-discontinued {
      background: #fee2e2;
      color: #991b1b;
      margin-left: 8px;
    }
    .footer {
      margin-top: 40px;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    @media print {
      body { padding: 20px; background: white; }
      .category { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Lista de Precios - SPISA</h1>
    <p>Gestión de precios unitarios por categoría</p>
  </div>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Categorías</div>
      <div class="stat-value">${data.totalCategories}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Artículos</div>
      <div class="stat-value">${data.totalArticles}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Fecha</div>
      <div class="stat-value">${new Date().toLocaleDateString('es-AR')}</div>
    </div>
  </div>

   ${displayData.map(category => `
    <div class="category">
      <div class="category-header">
        <div>
          <span class="category-title">${category.categoryName}</span>
          <span class="category-code">${category.categoryCode}</span>
        </div>
        <span class="category-count">${category.totalItems} artículos</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Código</th>
            <th style="width: 55%">Descripción</th>
            <th class="price" style="width: 15%">Precio Unitario</th>
            <th style="width: 15%">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${category.items.map(item => `
            <tr>
              <td style="font-family: monospace; font-size: 14px;">${item.code}</td>
              <td>
                ${item.description}
                ${item.isDiscontinued ? '<span class="badge badge-discontinued">Discontinuado</span>' : ''}
              </td>
              <td class="price">$${item.unitPrice.toFixed(2)}</td>
              <td>
                <span class="badge ${item.isActive ? 'badge-active' : 'badge-inactive'}">
                  ${item.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('')}

  <div class="footer">
    <p>Generado el ${new Date().toLocaleString('es-AR')} | SPISA - Sistema de Gestión de Inventario y Ventas</p>
  </div>
</body>
</html>`;

    // Crear y descargar el archivo
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-precios-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Lista de precios descargada correctamente');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Listas de Precios
          </h1>
          <p className="text-muted-foreground">
            Gestión de precios unitarios por categoría
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="price-lists" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Listas de Precios
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de Cambios
          </TabsTrigger>
        </TabsList>

        {/* Price Lists Tab */}
        <TabsContent value="price-lists" className="space-y-6">
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => setImportDialogOpen(true)}
              disabled={isLoading}
              variant="default"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <Button
              onClick={handleDownloadHTML}
              disabled={isLoading || !data || displayData.length === 0}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar HTML
            </Button>
          </div>

      {/* Filters */}
      <PriceListFilters
        categories={categoriesData?.data || []}
        selectedCategoryId={selectedCategoryId}
        searchTerm={searchTerm}
        activeOnly={activeOnly}
        onCategoryChange={setSelectedCategoryId}
        onSearchChange={setSearchTerm}
        onActiveOnlyChange={setActiveOnly}
      />

      {/* Pending Changes Alert */}
      {editingPrices.size > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Tienes <strong>{editingPrices.size}</strong> cambios sin guardar
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveChanges}
                disabled={updatePricesMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscardChanges}
                disabled={updatePricesMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Descartar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Proposed Prices Alert */}
      {proposedPrices.size > 0 && (
        <Alert className="border-blue-600 bg-blue-50 dark:bg-blue-950">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold mb-1">
                  Tienes <strong>{proposedPrices.size}</strong> precios propuestos desde CSV
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Valorización del stock de los <strong>{proposedPrices.size} artículos modificados</strong> (no incluye el resto del inventario)
                </div>
                <div className="text-sm space-y-3">
                  {/* Valorización por condición de pago */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allPaymentTerms.map(pt => {
                      const before = stockValue.before[pt.paymentTermCode] || 0;
                      const after = stockValue.after[pt.paymentTermCode] || 0;
                      const diff = after - before;
                      const diffPercent = before > 0 ? (diff / before * 100) : 0;
                      
                      return (
                        <div key={pt.paymentTermCode} className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
                          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {pt.paymentTermName} ({pt.discountPercent}%)
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Actual:</span>
                              <span className="font-mono text-gray-900 dark:text-gray-100">
                                ${before.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Propuesto:</span>
                              <span className={`font-mono ${after > before ? 'text-green-600' : 'text-red-600'}`}>
                                ${after.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                              <span>Diferencia:</span>
                              <span className={`font-mono font-semibold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diff > 0 ? '+' : ''}${diff.toFixed(2)} ({diffPercent.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={handleConfirmProposedPrices}
                  disabled={updatePricesMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Confirmar Nuevos Precios
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelProposedPrices}
                  disabled={updatePricesMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      {data && (
        <div className="flex gap-4 flex-wrap">
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            {displayData.length} categorías {proposedPrices.size > 0 && '(con cambios)'}
          </Badge>
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            {displayData.reduce((sum, cat) => sum + cat.items.length, 0)} artículos {proposedPrices.size > 0 && '(modificados)'}
          </Badge>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <p className="text-muted-foreground">Cargando listas de precios...</p>
        </div>
       ) : data && displayData.length > 0 ? (
        <Accordion type="multiple" className="space-y-4" defaultValue={displayData.map(c => c.categoryId.toString())}>
          {displayData.map((category) => (
            <AccordionItem
              key={category.categoryId}
              value={category.categoryId.toString()}
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-accent/50">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-lg">
                      {category.categoryName}
                    </span>
                    <Badge variant="outline">{category.categoryCode}</Badge>
                  </div>
                  <Badge variant="secondary">
                    {category.totalItems} artículos
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <PriceListTable
                  items={category.items}
                  paymentDiscounts={category.paymentDiscounts}
                  onPriceChange={handlePriceChange}
                  editingPrices={editingPrices}
                  proposedPrices={proposedPrices}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No se encontraron artículos</CardTitle>
            <CardDescription>
              No hay artículos que coincidan con los filtros seleccionados.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {/* Import Dialog */}
      <PriceImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onConfirm={handleImportConfirm}
        articles={allArticles}
        paymentTerms={allPaymentTerms}
      />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <PriceHistoryTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

