import { useState, useCallback } from 'react';
import { PaginationState } from '@/types/pagination';

interface UsePaginationResult {
  pagination: PaginationState;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSorting: (sortBy: string, sortDescending?: boolean) => void;
  resetPagination: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: (totalPages: number) => void;
}

export const usePagination = (initialPageSize: number = 10): UsePaginationResult => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageNumber: 1,
    pageSize: initialPageSize,
    sortBy: undefined,
    sortDescending: false,
  });

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, pageNumber: page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, pageNumber: 1 })); // Reset to first page when changing page size
  }, []);

  const setSorting = useCallback((sortBy: string, sortDescending: boolean = false) => {
    setPagination((prev) => ({
      ...prev,
      sortBy,
      sortDescending,
      pageNumber: 1, // Reset to first page when sorting changes
    }));
  }, []);

  const resetPagination = useCallback(() => {
    setPagination({
      pageNumber: 1,
      pageSize: initialPageSize,
      sortBy: undefined,
      sortDescending: false,
    });
  }, [initialPageSize]);

  const goToNextPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, pageNumber: Math.max(1, prev.pageNumber - 1) }));
  }, []);

  const goToFirstPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, pageNumber: 1 }));
  }, []);

  const goToLastPage = useCallback((totalPages: number) => {
    setPagination((prev) => ({ ...prev, pageNumber: totalPages }));
  }, []);

  return {
    pagination,
    setPage,
    setPageSize,
    setSorting,
    resetPagination,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  };
};


