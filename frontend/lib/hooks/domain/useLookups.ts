import { useQuery } from '@tanstack/react-query';
import type { TaxCondition, OperationType } from '@/types/api';

// Query key factories
export const lookupKeys = {
  taxConditions: ['lookups', 'tax-conditions'] as const,
  operationTypes: ['lookups', 'operation-types'] as const,
};

// API functions
const fetchTaxConditions = async (): Promise<TaxCondition[]> => {
  const response = await fetch('/api/lookups/tax-conditions');
  if (!response.ok) throw new Error('Failed to fetch tax conditions');
  return response.json();
};

const fetchOperationTypes = async (): Promise<OperationType[]> => {
  const response = await fetch('/api/lookups/operation-types');
  if (!response.ok) throw new Error('Failed to fetch operation types');
  return response.json();
};

// Hooks
export function useTaxConditions() {
  return useQuery({
    queryKey: lookupKeys.taxConditions,
    queryFn: fetchTaxConditions,
    staleTime: 1000 * 60 * 5, // 5 minutes - estos datos casi no cambian
  });
}

export function useOperationTypes() {
  return useQuery({
    queryKey: lookupKeys.operationTypes,
    queryFn: fetchOperationTypes,
    staleTime: 1000 * 60 * 5, // 5 minutes - estos datos casi no cambian
  });
}
