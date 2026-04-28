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

`lib/services/ArticleService.ts:enrichArticle` aplica `classifyStockStatus` con esta config (idéntica a `calculateStockValuation`):

```ts
{
  activeThresholdDays: 90,
  slowMovingThresholdDays: 180,
  deadStockThresholdDays: 365,
  minSalesForActive: 5,        // ventas/mes mínimas para ACTIVE
  trendMonths: 6,
  includeZeroStock: false,
}
```

Lógica resumida (ver código):

- Stock ≤ 0 o nunca vendido → `NEVER_SOLD`.
- `daysSinceLastSale > 365` → `DEAD_STOCK`.
- `daysSinceLastSale ≤ 90` y `avgMonthlySales ≥ 5` → `ACTIVE`.
- Si no, generalmente `SLOW_MOVING`.

## Si tenés que cambiar los umbrales globalmente

Editá `DEFAULT_STATUS_CONFIG` en `lib/services/ArticleService.ts` y `calculateStockValuation` (que recibe config como param). Verificá que `classifyStockStatus` tests sigan en verde. Documentá el cambio acá.
