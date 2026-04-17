import { useQuery, useQueryClient } from '@tanstack/react-query';
import { financialAnalysisApi } from '../../api/financialAnalysis';

export function useFinancialAnalysis() {
  return useQuery({
    queryKey: ['financial-analysis'],
    queryFn: () => financialAnalysisApi.getData(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

interface CostRow {
  year_month: string;
  source: string;
  category: string;
  amount_ars: number;
  amount_usd: number | null;
  exchange_rate: number | null;
}

interface CostsResponse {
  costs: Record<string, CostRow[]>;
  months: string[];
  totalRows: number;
}

export function useImportedCosts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['financial-analysis-costs'],
    queryFn: async (): Promise<CostsResponse> => {
      const res = await fetch('/api/financial-analysis/costs');
      if (!res.ok) throw new Error('Failed to fetch costs');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['financial-analysis-costs'] });
  };

  return { ...query, invalidate };
}
