# Patrones unificados del módulo de artículos

> **Para IAs/devs que vayan a tocar cualquier vista que muestre artículos.**
> Si agregás una pantalla nueva o modificás una existente, **reusá los helpers y el componente compartido** descritos acá. La meta es que todos los lugares donde se ven artículos muestren la misma información calculada igual.

## Fuentes de verdad (no las dupliques)

### Cálculos

| Qué necesitás                                                                             | Helper                                   | Path                                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Costo CIF (FOB × (1 + CIF%))                                                              | `getArticleCifCost(article)`             | `lib/utils/articles/marginCalculations.ts` |
| Descuento de categoría efectivo (mayor descuento por término de pago, fallback a default) | `getEffectiveCategoryDiscount(article)`  | `lib/utils/articles/marginCalculations.ts` |
| Precio de venta con descuento aplicado                                                    | `getArticleDiscountedSellPrice(article)` | `lib/utils/articles/marginCalculations.ts` |
| Margen % (canónico — usado en supplier-orders y article list)                             | `getArticleMarginPercent(article)`       | `lib/utils/articles/marginCalculations.ts` |
| Formatear margen como string (`+25.0%`, `—`)                                              | `formatMarginPercent(margin)`            | `lib/utils/articles/marginCalculations.ts` |
| Color del margen según rango                                                              | `getMarginColorClass(margin)`            | `lib/utils/articles/marginCalculations.ts` |
| Color del número de stock (rojo/naranja/verde según cantidad)                             | `getStockLevelColorClass(stock)`         | `lib/utils/articles/stockLevelColor.ts`    |
| Status canónico de rotación (4 estados)                                                   | `classifyStockStatus(...)`               | `lib/utils/articles/stockValuation.ts`     |
| Rating de velocidad de venta (Excelente/Bueno/Regular/Lento)                              | `getArticleActiveRating(article)`        | `lib/utils/articles/articleRating.ts`      |

**El backend ya devuelve `stockStatus`, `avgMonthlySales`, `trendDirection` en el DTO** cuando el hook pasa `includeTrends:true`. No los recalcules en el frontend.

### Componentes

| Componente                                          | Path                                       | Para qué                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<StockStatusBadge status={article.stockStatus} />` | `components/articles/StockStatusBadge.tsx` | Badge unificado de los 4 estados (active/slow/dead/never_sold). Renderiza `null` si el status no llegó (típicamente porque no se pidió `includeTrends`). |

## Cuándo cada cosa

| Querés mostrar...                      | Hacelo así                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| "¿Está activo o muerto este artículo?" | `<StockStatusBadge status={article.stockStatus} />` (requiere `includeTrends:true`)      |
| "¿Cuánto stock hay?" coloreado         | `<span className={getStockLevelColorClass(article.stock)}>Stock: {article.stock}</span>` |
| Costo real importado (CIF)             | `getArticleCifCost(article)` — devuelve `FOB × (1 + CIF%)` o `null` si falta FOB         |
| Precio que paga el cliente (con desc.) | `getArticleDiscountedSellPrice(article)` — `unitPrice × (1 - max payment discount/100)`  |
| Margen final (sobre CIF, c/desc)       | `formatMarginPercent(getArticleMarginPercent(article))`                                  |

**Regla de presentación**: el patrón canónico muestra los 4 valores juntos (lista, c/desc, CIF, FOB) cuando entran. FOB se muestra como detalle secundario al lado de CIF (el costo real). En espacios muy chicos (Select del wizard, edit compacto), priorizá precio lista + precio c/desc; FOB/CIF se omiten.

## Patrón canónico — dropdown de búsqueda de artículo

Para que cualquier nuevo dropdown de búsqueda quede consistente con `QuickArticleLookup`, `QuickCartPopup` (edit), y los dos dropdowns de `SingleStepOrderForm`:

```tsx
import { StockStatusBadge } from '@/components/articles/StockStatusBadge';
import {
  formatMarginPercent,
  getArticleCifCost,
  getArticleDiscountedSellPrice,
  getArticleMarginPercent,
  getMarginColorClass,
} from '@/lib/utils/articles/marginCalculations';
import { getStockLevelColorClass } from '@/lib/utils/articles/stockLevelColor';
import { useArticles } from '@/lib/hooks/domain/useArticles';

// 1. Hook con includeTrends:true → backend devuelve stockStatus
const { data } = useArticles({
  searchTerm,
  activeOnly: true,
  pageSize: 5,
  includeTrends: true,
});

// 2. Layout por fila — 5 líneas a la derecha (precio, c/desc, costo CIF+FOB, margen, stock)
{
  articles.map((article, index) => {
    const isSelected = index === selectedIndex;
    const margin = getArticleMarginPercent(article);
    const sell = getArticleDiscountedSellPrice(article);
    const cifCost = getArticleCifCost(article);
    return (
      <button
        onClick={() => onSelect(article)}
        className={isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Izquierda: code + status, descripción, categoría */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{article.code}</span>
              <StockStatusBadge status={article.stockStatus} className="shrink-0" />
            </div>
            <div className="text-xs">{article.description}</div>
            {article.categoryName && (
              <div className="text-muted-foreground mt-0.5 truncate text-[11px]">
                {article.categoryName}
              </div>
            )}
          </div>
          {/* Derecha: precio lista, precio c/desc, costo CIF (FOB), margen, stock */}
          <div className="flex-shrink-0 text-right">
            <div className="text-sm font-bold">{formatCurrency(article.unitPrice)}</div>
            {sell !== null && sell !== article.unitPrice && (
              <div className={`text-[11px] font-medium ${getMarginColorClass(margin)}`}>
                → {formatCurrency(sell)}
              </div>
            )}
            {cifCost !== null && (
              <div className="text-muted-foreground text-[11px]">
                Costo: USD {cifCost.toFixed(2)}
                {article.lastPurchasePrice ? ` (FOB ${article.lastPurchasePrice.toFixed(2)})` : ''}
              </div>
            )}
            <div className={`text-[11px] font-medium ${getMarginColorClass(margin)}`}>
              Margen: {formatMarginPercent(margin)}
            </div>
            <div className={`text-xs font-medium ${getStockLevelColorClass(article.stock)}`}>
              Stock: {article.stock}
            </div>
          </div>
        </div>
      </button>
    );
  });
}
```

### Variantes comprimidas (espacio chico)

- **Edit compacto (340px)** — `SingleStepOrderForm` lápiz inline: agregar al final de la tarjeta una línea con `formatCurrency(unitPrice)` + `→ formatCurrency(sell)` + margen, y otra con `Costo: USD X (FOB Y)` debajo. No 5 líneas.
- **Select del wizard** — `ItemsSelectionStep`: una sola línea horizontal `code · badge · descripción · categoría · $lista → $c-desc (margen)`. FOB/CIF se omiten.

## Componentes que ya siguen el patrón (referencia)

- `components/articles/ArticlesTable.tsx` — tabla principal de artículos.
- `components/articles/ValuationTable.tsx` — tabla de `/articles/valuation`.
- `components/articles/QuickArticleLookup.tsx` — dropdown del QuickCart.
- `components/articles/QuickCartPopup.tsx` — popup flotante del carrito (edit dropdown).
- `components/salesOrders/SingleStepOrderForm.tsx` — formulario de pedidos (add + edit dropdowns).
- `components/salesOrders/ItemsSelectionStep.tsx` — `<Select>` del wizard (versión compacta — solo code + status + descripción + categoría).

## Reglas duras

1. **No calcules margen, costo CIF, ni status inline.** Importá los helpers.
2. **No clasifiques stock manualmente** (`lastSaleDate > 365`, etc.). Pedí `includeTrends:true` y usá `article.stockStatus` + `<StockStatusBadge>`.
3. **No hardcodees umbrales** (90/180/365 días). El backend usa la misma config canónica en `enrichArticle` y `calculateStockValuation` — si necesitás otros umbrales, ese cambio se hace en el config, no por componente.
4. **No dupliques `getStockLevelColorClass`.** Importalo del helper compartido.
5. **No reemplaces `categoryDefaultDiscount` por nada.** Es el fallback legacy. Para descuento real usá `getEffectiveCategoryDiscount(article)`.

## Cuándo NO seguir el patrón

- **Listas que no son de artículos del catálogo** (ej. items de un pedido ya guardado, donde no tenés el Article completo). Usá la info que tengas y omití lo que falte.
- **Mocks parciales** (ej. `useSupplierOrderDraft.ts` reconstruye un `Article` de un item de pedido — los campos opcionales pueden quedar `null`/`0` y los helpers manejan eso bien).

## Cómo se calcula `stockStatus` (backend)

La clasificación tiene **dos capas** (ver `lib/utils/articles/stockValuation.ts`):

### Capa 1 — `computeCandidate` (regla pura por frecuencia, no velocidad)

Las señales que mira son: `currentStock`, `lastSaleDate`, `daysSinceLastSale`, y un `salesTrend: number[]` ordenado cronológicamente con el mes más reciente al final. La cantidad de unidades vendidas por mes ya no influye — sólo si hubo o no hubo ventas en cada mes.

```
candidate(signals, config):
  if currentStock <= 0 OR no lastSaleDate                                 → NEVER_SOLD
  if monthsWithSalesInLast(deadStockNoActivityWindowMonths) < minMonthsForLeavingDead
                                                                            → DEAD_STOCK
  if daysSinceLastSale <= activeThresholdDays
     AND monthsWithSalesInLast(3) >= minMonthsForActive                    → ACTIVE
  else                                                                     → SLOW_MOVING
```

Defaults (`DEFAULT_STATUS_CONFIG` en `ArticleService.ts`):

```ts
{
  activeThresholdDays: 90,                  // recencia para ACTIVE
  minMonthsForActive: 2,                    // de los últimos 3
  minMonthsForLeavingDead: 2,               // de los últimos 12
  deadStockNoActivityWindowMonths: 12,
  trendMonths: 6,                           // sólo afecta el sparkline / display
  includeZeroStock: false,
  // Capa 2 (histéresis)
  upgradeConfirmDays: 7,
  downgradeConfirmDays: 14,
  fastUpgradeMonthsThreshold: 4,
}
```

**Por qué frecuencia y no velocidad:** Dialfa es distribuidor B2B industrial. Muchos SKUs son lento-pero-recurrente (un cliente los pide una vez al año para mantenimiento). El threshold antiguo `minSalesForActive: 5` (≥5 unidades/mes) penalizaba injustamente esos productos. Frecuencia mensual los reconoce sin inflar las métricas con compras puntuales grandes.

### Capa 2 — Histéresis con confirmación por snapshots

`classifyStockStatus` toma el `candidate` y, si difiere del `previousStatus` (leído del último `article_status_snapshots`), exige que el candidato esté sostenido durante N días en la historia reciente (`getRecentArticleStatuses`):

- **Upgrade** (dead → slow, slow → active, NEVER_SOLD → cualquier estado con stock): requiere `upgradeConfirmDays = 7` snapshots consecutivos del candidato.
- **Downgrade** (active → slow, slow → dead): requiere `downgradeConfirmDays = 14` snapshots.
- **Escape hatch**: si `monthsWithSalesInLast(6) >= fastUpgradeMonthsThreshold (4)`, los upgrades saltan la confirmación. Evita encerrar reactivaciones claramente sostenidas.
- **Primera ejecución** (sin historia o historia más corta que el `confirmDays`): se acepta el candidato directo.

`confirmedFor` cuenta **días con snapshot que coinciden con el target**, no días calendario, así que tolera huecos en el cron.

### Campos deprecados del config

Los siguientes campos de `StockClassificationConfig` se mantienen por retrocompatibilidad (la API y la UI de filtros aún los aceptan) pero **no afectan la clasificación**:

- `slowMovingThresholdDays` — sin efecto.
- `deadStockThresholdDays` (en días) — reemplazado por `deadStockNoActivityWindowMonths` (en meses).
- `minSalesForActive` — eliminado en favor de la regla de frecuencia.

Sin embargo `activeThresholdDays` (90 días por default) **sigue activo**: define la ventana de recencia que la candidatura a ACTIVE exige (`daysSinceLastSale ≤ activeThresholdDays`).

## Si tenés que cambiar los umbrales globalmente

Editá `DEFAULT_STATUS_CONFIG` en `lib/services/ArticleService.ts`. La misma config se usa en `enrichArticle` y `calculateStockValuation` — modificarla en un solo lugar es suficiente. Verificá que `classifyStockStatus` tests sigan en verde. Documentá el cambio acá.
