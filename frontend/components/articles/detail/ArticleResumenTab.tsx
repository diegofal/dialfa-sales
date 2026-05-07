'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Article } from '@/types/article';

interface ArticleResumenTabProps {
  article: Article;
}

const formatArs = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

export function ArticleResumenTab({ article }: ArticleResumenTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos clave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Código" value={<span className="font-mono">{article.code}</span>} />
          <Row label="Categoría" value={article.categoryName} />
          <Row label="Precio de lista" value={formatArs(article.unitPrice)} />
          <Row
            label="Costo (referencial)"
            value={article.costPrice != null ? formatArs(article.costPrice) : '—'}
          />
          <Row
            label="Última compra (FOB USD)"
            value={
              article.lastPurchasePrice != null
                ? `US$ ${article.lastPurchasePrice.toFixed(2)}`
                : '—'
            }
          />
          <Row
            label="CIF %"
            value={article.cifPercentage != null ? `${article.cifPercentage}%` : '—'}
          />
          <Row
            label="Proforma origen"
            value={
              article.lastPurchaseProformaNumber
                ? `${article.lastPurchaseProformaNumber}${
                    article.lastPurchaseProformaDate
                      ? ` · ${article.lastPurchaseProformaDate.slice(0, 10)}`
                      : ''
                  }`
                : '—'
            }
          />
          <Row
            label="Peso unitario"
            value={article.weightKg != null ? `${article.weightKg} kg` : '—'}
          />
          <Row label="Ubicación" value={article.location || '—'} />
          {article.notes && (
            <div className="border-border/40 mt-3 border-t pt-3">
              <div className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                Notas
              </div>
              <p className="text-sm whitespace-pre-wrap">{article.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {article.salesTrend && article.salesTrend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Tendencia de ventas ({article.salesTrend.length} meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SparklineWithTooltip
                data={article.salesTrend}
                labels={article.salesTrendLabels}
                width={420}
                height={100}
                color="rgb(34, 197, 94)"
              />
              <div className="text-muted-foreground mt-2 text-xs">
                Promedio mensual: {(article.avgMonthlySales ?? 0).toFixed(1)} u
                {article.trendDirection && article.trendDirection !== 'none' && (
                  <span className="ml-2">
                    · Tendencia:{' '}
                    {article.trendDirection === 'increasing'
                      ? '↗ creciente'
                      : article.trendDirection === 'decreasing'
                        ? '↘ decreciente'
                        : '→ estable'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {article.categoryPaymentDiscounts && article.categoryPaymentDiscounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descuentos por término de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-xs uppercase">
                  <tr className="border-b">
                    <th className="pb-2 text-left">Término</th>
                    <th className="pb-2 text-right">Días</th>
                    <th className="pb-2 text-right">Descuento</th>
                    <th className="pb-2 text-right">Precio neto</th>
                  </tr>
                </thead>
                <tbody>
                  {article.categoryPaymentDiscounts.map((d) => {
                    const netPrice = article.unitPrice * (1 - d.discountPercent / 100);
                    return (
                      <tr key={d.paymentTermId ?? d.paymentTermCode} className="border-b">
                        <td className="py-1.5 font-medium">{d.paymentTermName}</td>
                        <td className="text-muted-foreground py-1.5 text-right">{d.days}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {d.discountPercent.toFixed(2)}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{formatArs(netPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border/40 flex items-baseline justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
