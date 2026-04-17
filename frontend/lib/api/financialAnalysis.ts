import { FinancialAnalysisResponse } from '@/types/financialAnalysis';
import apiClient from './client';

export const financialAnalysisApi = {
  getData: async (): Promise<FinancialAnalysisResponse> => {
    const { data } = await apiClient.get<FinancialAnalysisResponse>('/financial-analysis');
    return data;
  },
};
