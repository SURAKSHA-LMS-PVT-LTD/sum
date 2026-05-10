import { useState, useCallback } from 'react';

export interface PaginationConfig {
  defaultLimit?: number;
  availableLimits?: number[];
}

export interface PaginationState {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface PaginationActions {
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setTotalCount: (count: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export interface UsePaginationReturn {
  pagination: PaginationState;
  actions: PaginationActions;
  availableLimits: number[];
  getApiParams: () => { page: number; limit: number };
}

const DEFAULT_CONFIG: Required<PaginationConfig> = {
  defaultLimit: 50,
  availableLimits: [25, 50, 100]
};

export const usePagination = (config: PaginationConfig = {}): UsePaginationReturn => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [page, setPageState] = useState(0); // MUI pagination is 0-based
  const [limit, setLimitState] = useState(finalConfig.defaultLimit);
  const [totalCount, setTotalCountState] = useState(0);

  const totalPages = Math.ceil(totalCount / limit);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(0, Math.min(newPage, totalPages - 1)));
  }, [totalPages]);

  const setLimit = useCallback((newLimit: number) => {
    if (finalConfig.availableLimits.includes(newLimit)) {
      setLimitState(newLimit);
      setPageState(0); // Reset to first page when limit changes
    }
  }, [finalConfig.availableLimits]);

  const setTotalCount = useCallback((count: number) => {
    setTotalCountState(Math.max(0, count));
  }, []);

  const nextPage = useCallback(() => {
    if (page < totalPages - 1) {
      setPage(page + 1);
    }
  }, [page, totalPages, setPage]);

  const prevPage = useCallback(() => {
    if (page > 0) {
      setPage(page - 1);
    }
  }, [page, setPage]);

  const reset = useCallback(() => {
    setPageState(0);
    setLimitState(finalConfig.defaultLimit);
    setTotalCountState(0);
  }, [finalConfig.defaultLimit]);

  const getApiParams = useCallback(() => ({
    page: page + 1, // API expects 1-based pagination
    limit
  }), [page, limit]);

  return {
    pagination: {
      page,
      limit,
      totalCount,
      totalPages
    },
    actions: {
      setPage,
      setLimit,
      setTotalCount,
      nextPage,
      prevPage,
      reset
    },
    availableLimits: finalConfig.availableLimits,
    getApiParams
  };
};