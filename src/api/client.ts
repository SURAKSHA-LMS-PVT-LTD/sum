export const apiClient = {
  get: <T>(url: string): Promise<T> => Promise.resolve({} as T),
  post: <T>(url: string, data: any): Promise<T> => Promise.resolve({} as T),
  patch: <T>(url: string, data: any): Promise<T> => Promise.resolve({} as T),
  delete: (url: string): Promise<void> => Promise.resolve(),
  put: (url: string, data: any): Promise<void> => Promise.resolve(),
};