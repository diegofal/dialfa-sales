'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  type ImportSource,
  type ParsedCostRow,
} from '@/lib/utils/financialImport/types';

interface ImportDialogProps {
  onImportComplete: () => void;
}

interface ParseResult {
  rows: ParsedCostRow[];
  summary: {
    monthsDetected: string[];
    totalRows: number;
    source: ImportSource;
  };
}

function fmt(n: number): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

const FILE_TYPES: { value: ImportSource; label: string; accept: string; hint: string }[] = [
  {
    value: 'bank_extract',
    label: 'Extracto Bancario',
    accept: '.xlsx,.xls',
    hint: 'gastos_mensual_diego.xlsx — Sheet "Dashboard Anual"',
  },
  {
    value: 'planilla_diaria',
    label: 'Planilla Diaria',
    accept: '.xlsx,.xls',
    hint: 'PLANILLA DIARIA.xlsx — Gastos en efectivo',
  },
  {
    value: 'salarios',
    label: 'Salarios',
    accept: '.xlsx,.xls',
    hint: 'SALARIOS.xlsx — Nómina con tipo de cambio',
  },
];

export function ImportDialog({ onImportComplete }: ImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ImportSource>('bank_extract');
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', selectedType);

      const res = await fetch('/api/financial-analysis/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al parsear archivo');
      }

      const result: ParseResult = await res.json();
      setPreview(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al parsear archivo');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setIsConfirming(true);

    try {
      const res = await fetch('/api/financial-analysis/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview.rows }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al confirmar import');
      }

      const result = await res.json();
      toast.success(`Importado: ${result.upserted} registros en ${result.months.length} meses`);
      setPreview(null);
      setIsOpen(false);
      if (fileRef.current) fileRef.current.value = '';
      onImportComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al confirmar import');
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Importar Datos
      </Button>
    );
  }

  // Group preview rows by month for display
  const previewByMonth = preview
    ? preview.rows.reduce(
        (acc, row) => {
          if (!acc[row.yearMonth]) acc[row.yearMonth] = [];
          acc[row.yearMonth].push(row);
          return acc;
        },
        {} as Record<string, ParsedCostRow[]>
      )
    : {};

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Importar Datos de Costos
          </h3>
          <button
            onClick={() => {
              setIsOpen(false);
              setPreview(null);
            }}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* File type selector */}
        <div className="mb-3 flex gap-2">
          {FILE_TYPES.map((ft) => (
            <button
              key={ft.value}
              onClick={() => {
                setSelectedType(ft.value);
                setPreview(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                selectedType === ft.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {ft.label}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="text-muted-foreground mb-2 text-[10px]">
          {FILE_TYPES.find((f) => f.value === selectedType)?.hint}
        </p>

        {/* File input */}
        <div className="mb-3">
          <input
            ref={fileRef}
            type="file"
            accept={FILE_TYPES.find((f) => f.value === selectedType)?.accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="file:border-border file:bg-background file:text-foreground text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5 file:text-xs"
          />
        </div>

        {/* Parsing state */}
        {isParsing && (
          <div className="flex items-center gap-2 py-4">
            <Spinner className="h-4 w-4" />
            <span className="text-sm">Parseando archivo...</span>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div>
            <div className="bg-muted/50 mb-3 rounded-lg p-3">
              <div className="flex gap-4 text-xs">
                <span>
                  <strong>{SOURCE_LABELS[preview.summary.source]}</strong>
                </span>
                <span>
                  {preview.summary.totalRows} registros en {preview.summary.monthsDetected.length}{' '}
                  meses
                </span>
                <span className="text-muted-foreground">
                  {preview.summary.monthsDetected[0]} →{' '}
                  {preview.summary.monthsDetected[preview.summary.monthsDetected.length - 1]}
                </span>
              </div>
            </div>

            <div className="max-h-[350px] overflow-auto">
              {Object.entries(previewByMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, rows]) => (
                  <div key={month} className="mb-2">
                    <div className="bg-muted/30 text-muted-foreground sticky top-0 px-2 py-1 text-[10px] font-semibold uppercase">
                      {month}
                    </div>
                    <table className="w-full text-[11px]">
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-border/20 border-b">
                            <td className="px-2 py-0.5">
                              {CATEGORY_LABELS[row.category] || row.category}
                            </td>
                            <td className="px-2 py-0.5 text-right tabular-nums">
                              ${fmt(row.amountArs)} ARS
                            </td>
                            {row.amountUsd !== undefined && (
                              <td className="text-muted-foreground px-2 py-0.5 text-right tabular-nums">
                                ${fmt(row.amountUsd)} USD
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleConfirm} disabled={isConfirming}>
                {isConfirming ? (
                  <>
                    <Spinner className="mr-1 h-3 w-3" /> Importando...
                  </>
                ) : (
                  `Confirmar Import (${preview.summary.totalRows} registros)`
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
