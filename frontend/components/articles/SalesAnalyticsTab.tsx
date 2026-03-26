'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/lib/hooks/domain/useCategories';
import { useSalesAnalytics } from '@/lib/hooks/domain/useSalesAnalytics';
import { CategoryPieChart } from './CategoryPieChart';
import { RevenueChart } from './RevenueChart';
import { SalesKPICards } from './SalesKPICards';
import { StockEvolutionChart } from './StockEvolutionChart';
import { TopArticlesChart } from './TopArticlesChart';

function getPresetDates(months: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  start.setDate(1);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function SalesAnalyticsTab() {
  const defaultDates = getPresetDates(12);
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [presetValue, setPresetValue] = useState<string>('12');
  const [categoryId, setCategoryId] = useState<string>('all');

  const { data: categories } = useCategories({ activeOnly: true });

  const { data, isLoading, error } = useSalesAnalytics({
    periodMonths: 0,
    startDate,
    endDate,
    categoryId: categoryId !== 'all' ? parseInt(categoryId) : undefined,
  });

  const handlePresetChange = (value: string) => {
    setPresetValue(value);
    const months = parseInt(value);
    const dates = getPresetDates(months);
    setStartDate(dates.start);
    setEndDate(dates.end);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setPresetValue('custom');
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setPresetValue('custom');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="space-y-2 md:w-[200px]">
          <label className="text-sm font-medium">Período</label>
          <Select value={presetValue} onValueChange={handlePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="12 meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mes</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Desde</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Hasta</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="w-[160px]"
          />
        </div>

        <div className="space-y-2 md:w-[200px]">
          <label className="text-sm font-medium">Categoría</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories?.data?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando análisis de ventas...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">Error al cargar datos de ventas</p>
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          {/* KPI Cards */}
          <SalesKPICards kpis={data.kpis} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueChart data={data.revenueByMonth} />
            <CategoryPieChart data={data.salesByCategory} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopArticlesChart data={data.topArticles} />
            <StockEvolutionChart data={data.stockEvolution} />
          </div>
        </>
      )}
    </div>
  );
}
