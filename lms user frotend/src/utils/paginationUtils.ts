// Standardized pagination utility for API calls and components
export interface StandardPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface StandardPaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 50,
  availableLimits: [25, 50, 100]
};

export const buildPaginationParams = (params: Partial<StandardPaginationParams>): string => {
  const searchParams = new URLSearchParams();
  
  searchParams.append('page', (params.page || DEFAULT_PAGINATION.page).toString());
  searchParams.append('limit', (params.limit || DEFAULT_PAGINATION.limit).toString());
  
  if (params.sortBy) {
    searchParams.append('sortBy', params.sortBy);
  }
  
  if (params.sortOrder) {
    searchParams.append('sortOrder', params.sortOrder);
  }
  
  return searchParams.toString();
};

export const calculatePaginationInfo = (total: number, page: number, limit: number) => ({
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1
});