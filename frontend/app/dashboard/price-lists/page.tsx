'use client';

import {
  AlertCircle,
  Save,
  X,
  DollarSign,
  Download,
  Upload,
  History,
  List,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { PriceHistoryTable } from '@/components/priceLists/PriceHistoryTable';
import { PriceImportDialog } from '@/components/priceLists/PriceImportDialog';
import { PriceListFilters } from '@/components/priceLists/PriceListFilters';
import { PriceListTable } from '@/components/priceLists/PriceListTable';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategories } from '@/lib/hooks/domain/useCategories';
import { usePriceImportDraft } from '@/lib/hooks/domain/usePriceImportDraft';
import { usePriceLists, useUpdatePrices } from '@/lib/hooks/domain/usePriceLists';
import { sortArticlesByCategory } from '@/lib/utils/articleSorting';
import { useAuthStore } from '@/store/authStore';
import { BulkPriceUpdate } from '@/types/priceList';

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
  const [activeOnly, setActiveOnly] = useState<boolean>(false); // Include discontinued articles
  const [editingPrices, setEditingPrices] = useState<Map<number, number>>(new Map());
  const [proposedPrices, setProposedPrices] = useState<Map<number, number>>(new Map()); // Precios del CSV
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Queries - DEBEN estar antes del early return
  const { data: categoriesData } = useCategories({ activeOnly: true, pageSize: 500 });

  // Debug: Ver qué categorías está trayendo
  useEffect(() => {
    if (categoriesData?.data) {
      console.log(
        'Categorías cargadas:',
        categoriesData.data.map((c) => ({ code: c.code, name: c.name }))
      );
    }
  }, [categoriesData]);

  const { data, isLoading } = usePriceLists({
    categoryId: selectedCategoryId !== 'all' ? parseInt(selectedCategoryId) : undefined,
    search: searchTerm || undefined,
    activeOnly,
  });
  const updatePricesMutation = useUpdatePrices();
  const { loadDraft, saveDraft, deleteDraft, isSaving } = usePriceImportDraft();

  // Cargar borrador guardado al montar el componente
  useEffect(() => {
    const loadSavedDraft = async () => {
      const draft = await loadDraft();
      if (draft && draft.size > 0) {
        setProposedPrices(draft);
        toast.info(`Se recuperaron ${draft.size} precios propuestos guardados anteriormente`, {
          duration: 5000,
        });
      }
    };

    loadSavedDraft();
  }, [loadDraft]);

  // Verificar permisos DESPUÉS de los hooks
  if (!isAdmin()) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para acceder a esta página. Solo los administradores pueden ver y
            editar listas de precios.
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
    } catch {
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
    updates.forEach((update) => {
      newProposedPrices.set(update.articleId, update.newPrice);
    });
    setProposedPrices(newProposedPrices);

    // Guardar en base de datos
    const saved = await saveDraft(newProposedPrices);

    if (saved) {
      toast.success(
        `${updates.length} precios preparados y guardados. Revisa y confirma los cambios.`
      );
    } else {
      toast.warning(`${updates.length} precios preparados (no se pudo guardar en BD)`);
    }
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

      // Eliminar borrador de la BD después de confirmar
      await deleteDraft();

      setProposedPrices(new Map()); // Limpiar precios propuestos
      toast.success('Precios actualizados exitosamente');
    } catch {
      // Error ya manejado
    }
  };

  const handleCancelProposedPrices = async () => {
    // Eliminar de la BD
    await deleteDraft();

    // Limpiar estado local
    setProposedPrices(new Map());

    toast.info('Precios propuestos cancelados y eliminados');
  };

  // Crear array plano de todos los artículos para el import con payment discounts
  const allArticles =
    data?.data.flatMap((category) =>
      category.items.map((item) => ({
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
  const allPaymentTerms =
    data?.data
      .flatMap((category) => category.paymentDiscounts)
      .filter(
        (discount, index, self) =>
          index === self.findIndex((d) => d.paymentTermId === discount.paymentTermId)
      )
      .sort((a, b) => a.paymentTermCode.localeCompare(b.paymentTermCode)) || [];

  // Ordenar items usando el algoritmo global de ordenamiento
  // Ver: lib/utils/articleSorting.ts para documentación completa
  const sortedData = data ? sortArticlesByCategory(data.data) : [];

  // Calcular stock valorizado por condición de pago SOLO para items modificados
  const calculateStockValue = () => {
    if (!data || proposedPrices.size === 0) return { before: {}, after: {} };

    const beforeByPaymentTerm: Record<string, number> = {};
    const afterByPaymentTerm: Record<string, number> = {};

    // Inicializar con todos los payment terms
    allPaymentTerms.forEach((pt) => {
      beforeByPaymentTerm[pt.paymentTermCode] = 0;
      afterByPaymentTerm[pt.paymentTermCode] = 0;
    });

    // Iterar solo sobre los items que tienen precio propuesto
    sortedData.forEach((category) => {
      category.items.forEach((item) => {
        const proposedPrice = proposedPrices.get(item.id);

        // SOLO calcular si este item tiene un precio propuesto
        if (!proposedPrice) return;

        const basePrice = item.unitPrice;

        // Calcular valorización por cada payment term
        category.paymentDiscounts.forEach((pd) => {
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
  const displayData =
    proposedPrices.size > 0
      ? sortedData
          .map((category) => ({
            ...category,
            items: category.items.filter((item) => proposedPrices.has(item.id)),
          }))
          .filter((category) => category.items.length > 0) // Solo categorías con items modificados
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
      font-size: 13px;
    }
    thead {
      background: #f8f9fa;
    }
    th {
      text-align: left;
      padding: 12px 15px;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
    }
    th.right { text-align: right; }
    td {
      padding: 10px 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    td.right {
      text-align: right;
      font-weight: 600;
      font-size: 14px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
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
      margin-left: 4px;
    }
    .positive {
      color: #059669;
    }
    .negative {
      color: #dc2626;
    }
    .footer {
      margin-top: 40px;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    @media print {
      body { padding: 10px; background: white; font-size: 10px; }
      .category { 
        page-break-inside: avoid;
        margin-bottom: 20px;
      }
      table { font-size: 9px; }
      th, td { padding: 4px 6px; }
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

   ${displayData
     .map(
       (category) => `
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
            <th style="width: 45%">Descripción</th>
            <th class="right" style="width: 20%">Precio Base</th>
            <th class="right" style="width: 20%">Precio Propuesto</th>
          </tr>
        </thead>
        <tbody>
          ${category.items
            .map((item) => {
              const proposedPrice = proposedPrices.get(item.id);
              const priceToUse = proposedPrice || item.unitPrice;
              const priceChange = proposedPrice
                ? ((proposedPrice - item.unitPrice) / item.unitPrice) * 100
                : 0;

              return `
            <tr>
              <td style="font-family: monospace; font-size: 12px;">${item.code}</td>
              <td style="font-size: 12px;">
                ${item.description}
                ${item.isDiscontinued ? '<span class="badge badge-discontinued">Discontinuado</span>' : ''}
              </td>
              <td class="right">$${item.unitPrice.toFixed(2)}</td>
              <td class="right ${proposedPrice ? (priceChange > 0 ? 'positive' : 'negative') : ''}">
                $${priceToUse.toFixed(2)}
                ${proposedPrice ? `<br><small style="font-size: 10px;">${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}%</small>` : ''}
              </td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `
     )
     .join('')}

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

  const handleExportCSV = () => {
    if (!data || displayData.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    // Generar CSV con Código y Precio Propuesto
    let csvContent = 'Codigo,PrecioPropuesto\n';

    displayData.forEach((category) => {
      category.items.forEach((item) => {
        const proposedPrice = proposedPrices.get(item.id);
        const priceToUse = proposedPrice || item.unitPrice;
        csvContent += `${item.code},${priceToUse.toFixed(2)}\n`;
      });
    });

    // Crear y descargar el archivo CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precios-propuestos-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('CSV exportado correctamente');
  };

  const handleExportExcel = () => {
    if (!data || displayData.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    // Preparar datos para Excel
    const excelData: Array<{ Codigo: string; PrecioPropuesto: number }> = [];

    displayData.forEach((category) => {
      category.items.forEach((item) => {
        const proposedPrice = proposedPrices.get(item.id);
        const priceToUse = proposedPrice || item.unitPrice;
        excelData.push({
          Codigo: item.code,
          PrecioPropuesto: Number(priceToUse.toFixed(2)),
        });
      });
    });

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precios Propuestos');

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, // Codigo
      { wch: 18 }, // PrecioPropuesto
    ];

    // Descargar archivo
    XLSX.writeFile(wb, `precios-propuestos-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast.success('Excel exportado correctamente');
  };

  /**
   * Exportar formato XLS Dialfa - Formato específico para lista de bridas
   * Todo en una sola hoja: S-150, S-300, S-600 uno debajo del otro
   */
  const handleExportDialfa = () => {
    if (!data || displayData.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    // Definir el orden de diámetros
    const sizeOrder = [
      '1/2"',
      '3/4"',
      '1"',
      '1 1/4"',
      '1 1/2"',
      '2"',
      '2 1/2"',
      '3"',
      '4"',
      '5"',
      '6"',
      '8"',
      '10"',
      '12"',
      '14"',
      '16"',
      '18"',
      '20"',
      '24"',
    ];

    // Normalizar tamaño para comparación
    const normalizeSize = (size: string | undefined): string => {
      if (!size) return '';
      let s = size.trim().toUpperCase();
      if (!s.endsWith('"') && !s.endsWith("'")) {
        s = s + '"';
      }
      s = s.replace(/'/g, '"');
      return s;
    };

    // Mapear tipos a columnas (incluir códigos cortos y variantes)
    const typeToColumn: Record<string, string> = {
      // Livianas
      LIVIANA: 'LIVIANAS',
      L: 'LIVIANAS',
      // S.O.R.F. (Slip On Raised Face)
      SORF: 'S.O.R.F.',
      'S.O.R.F.': 'S.O.R.F.',
      S: 'S.O.R.F.',
      SO: 'S.O.R.F.',
      'SLIP ON': 'S.O.R.F.',
      // W.N.R.F. (Welding Neck Raised Face)
      WNRF: 'W.N.R.F.',
      'W.N.R.F.': 'W.N.R.F.',
      W: 'W.N.R.F.',
      WN: 'W.N.R.F.',
      'WELDING NECK': 'W.N.R.F.',
      // Ciegas (Blind)
      CIEGA: 'CIEGAS',
      BLIND: 'CIEGAS',
      C: 'CIEGAS',
      BL: 'CIEGAS',
      // Roscadas (Threaded)
      ROSCADA: 'ROSCADAS',
      THREADED: 'ROSCADAS',
      R: 'ROSCADAS',
      TH: 'ROSCADAS',
    };

    // Estructura para almacenar datos por serie
    const seriesData: Record<number, Record<string, Record<string, number>>> = {
      150: {},
      300: {},
      600: {},
    };

    // Columnas por serie (S-150 tiene más columnas que S-300 y S-600)
    const columnsBySeries: Record<number, string[]> = {
      150: ['DIAMETRO', 'LIVIANAS', 'S.O.R.F.', 'W.N.R.F.', 'CIEGAS', 'ROSCADAS'],
      300: ['DIAMETRO', 'S.O.R.F.', 'W.N.R.F.', 'CIEGAS'],
      600: ['DIAMETRO', 'S.O.R.F.', 'W.N.R.F.', 'CIEGAS'],
    };

    // Número máximo de columnas (para S-150)
    const maxCols = 6;

    // Mapear espesores estándar (solo estos se exportan en la lista Dialfa)
    const isStandardThickness = (thickness: string | undefined): boolean => {
      if (!thickness) return true; // Si no tiene espesor, asumimos estándar
      const t = thickness.toUpperCase().trim();
      // STD, 40, Sch. 40, SCH40, S.40 son espesores estándar
      return (
        t === 'STD' || t === '40' || t === 'SCH. 40' || t === 'SCH40' || t === 'S.40' || t === ''
      );
    };

    // Procesar todos los artículos
    displayData.forEach((category) => {
      category.items.forEach((item) => {
        const series = item.series;
        const type = item.type?.toUpperCase();
        const size = normalizeSize(item.size);
        const thickness = item.thickness;

        if (!series || ![150, 300, 600].includes(series)) return;
        if (!type || !size) return;

        // Solo exportar artículos con espesor estándar
        if (!isStandardThickness(thickness)) return;

        const proposedPrice = proposedPrices.get(item.id);
        const price = proposedPrice || item.unitPrice;

        const column = typeToColumn[type];
        if (!column) return;

        if (!seriesData[series][size]) {
          seriesData[series][size] = {};
        }

        seriesData[series][size][column] = price;
      });
    });

    // Obtener mes y año actual
    const now = new Date();
    const monthNames = [
      'ENERO',
      'FEBRERO',
      'MARZO',
      'ABRIL',
      'MAYO',
      'JUNIO',
      'JULIO',
      'AGOSTO',
      'SEPTIEMBRE',
      'OCTUBRE',
      'NOVIEMBRE',
      'DICIEMBRE',
    ];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    // Crear UNA SOLA hoja con todo el contenido
    const sheetData: (string | number | null)[][] = [];
    const merges: XLSX.Range[] = [];

    // Título principal
    sheetData.push([`LISTA DE PRECIOS DE BRIDAS ${currentMonth} ${currentYear}`]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } });
    sheetData.push([]); // Fila vacía

    // Procesar cada serie una debajo de la otra
    [150, 300, 600].forEach((series, seriesIndex) => {
      const columns = columnsBySeries[series];
      const seriesRows = seriesData[series];

      // Subtítulo de serie
      const seriesStartRow = sheetData.length;
      sheetData.push([`S-${series}`]);
      merges.push({
        s: { r: seriesStartRow, c: 0 },
        e: { r: seriesStartRow, c: columns.length - 1 },
      });
      sheetData.push([]); // Fila vacía

      // Encabezados
      const headerRow: (string | null)[] = [...columns];
      // Rellenar con null hasta maxCols para mantener consistencia
      while (headerRow.length < maxCols) headerRow.push(null);
      sheetData.push(headerRow);

      // Datos ordenados por tamaño
      sizeOrder.forEach((size) => {
        if (seriesRows[size]) {
          const row: (string | number | null)[] = [size];
          columns.slice(1).forEach((col) => {
            const value = seriesRows[size][col];
            row.push(value !== undefined ? value : null);
          });
          // Rellenar con null hasta maxCols
          while (row.length < maxCols) row.push(null);
          sheetData.push(row);
        }
      });

      // Espacio entre secciones (excepto la última)
      if (seriesIndex < 2) {
        sheetData.push([]); // Fila vacía
        sheetData.push([]); // Fila vacía
      }
    });

    // Notas al pie
    sheetData.push([]); // Fila vacía
    sheetData.push(['PRECIOS EN DOLARES ESTADOUNIDENSES']);
    sheetData.push([]);
    sheetData.push(['LOS PRECIOS NO INCLUYEN I.V.A.']);
    sheetData.push([]);
    sheetData.push(['LAS LISTAS SON NETAS']);

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 12 }, // DIAMETRO
      { wch: 10 }, // LIVIANAS / S.O.R.F.
      { wch: 10 }, // S.O.R.F. / W.N.R.F.
      { wch: 10 }, // W.N.R.F. / CIEGAS
      { wch: 10 }, // CIEGAS
      { wch: 10 }, // ROSCADAS
    ];

    // Aplicar merges
    ws['!merges'] = merges;

    // Crear workbook y agregar hoja
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bridas');

    // Descargar archivo
    const filename = `BRIDAS_DIALFA_${currentMonth}_${currentYear}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast.success(`Archivo "${filename}" exportado correctamente`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <DollarSign className="h-8 w-8" />
            Listas de Precios
          </h1>
          <p className="text-muted-foreground">Gestión de precios unitarios por categoría</p>
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
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setImportDialogOpen(true)}
              disabled={isLoading}
              variant="default"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV
            </Button>

            {/* Dropdown para exportar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isLoading || !data || displayData.length === 0} variant="outline">
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDialfa}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  XLS Dialfa (Bridas)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Exportar Excel (XLS)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadHTML}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar HTML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDiscardChanges}
                    disabled={updatePricesMutation.isPending}
                  >
                    <X className="mr-2 h-4 w-4" />
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
                    <div className="mb-1 flex items-center gap-2 font-semibold">
                      Tienes <strong>{proposedPrices.size}</strong> precios propuestos desde CSV
                      {isSaving && (
                        <span className="animate-pulse text-xs text-blue-600">Guardando...</span>
                      )}
                    </div>
                    <div className="mb-3 text-xs text-gray-600 dark:text-gray-400">
                      Valorización del stock de los{' '}
                      <strong>{proposedPrices.size} artículos modificados</strong> (no incluye el
                      resto del inventario)
                    </div>
                    <div className="space-y-3 text-sm">
                      {/* Valorización por condición de pago */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {allPaymentTerms.map((pt) => {
                          const before = stockValue.before[pt.paymentTermCode] || 0;
                          const after = stockValue.after[pt.paymentTermCode] || 0;
                          const diff = after - before;
                          const diffPercent = before > 0 ? (diff / before) * 100 : 0;

                          return (
                            <div
                              key={pt.paymentTermCode}
                              className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                            >
                              <div className="mb-2 font-semibold text-gray-700 dark:text-gray-300">
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
                                  <span
                                    className={`font-mono ${after > before ? 'text-green-600' : 'text-red-600'}`}
                                  >
                                    ${after.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-1 dark:border-gray-700">
                                  <span>Diferencia:</span>
                                  <span
                                    className={`font-mono font-semibold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}
                                  >
                                    {diff > 0 ? '+' : ''}${diff.toFixed(2)} (
                                    {diffPercent.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleConfirmProposedPrices}
                      disabled={updatePricesMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Confirmar Nuevos Precios
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelProposedPrices}
                      disabled={updatePricesMutation.isPending}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          {data && (
            <div className="flex flex-wrap gap-4">
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                {displayData.length} categorías {proposedPrices.size > 0 && '(con cambios)'}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                {displayData.reduce((sum, cat) => sum + cat.items.length, 0)} artículos{' '}
                {proposedPrices.size > 0 && '(modificados)'}
              </Badge>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Cargando listas de precios...</p>
            </div>
          ) : data && displayData.length > 0 ? (
            <Accordion
              type="multiple"
              className="space-y-4"
              defaultValue={displayData.map((c) => c.categoryId.toString())}
            >
              {displayData.map((category) => (
                <AccordionItem
                  key={category.categoryId}
                  value={category.categoryId.toString()}
                  className="rounded-lg border"
                >
                  <AccordionTrigger className="hover:bg-accent/50 px-6 hover:no-underline">
                    <div className="flex w-full items-center justify-between pr-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold">{category.categoryName}</span>
                        <Badge variant="outline">{category.categoryCode}</Badge>
                      </div>
                      <Badge variant="secondary">{category.totalItems} artículos</Badge>
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
