export const enhancedCachedClient = {
    get: <T>(url: string, params: any, options: any) => {
        return Promise.resolve({} as T);
    },
    patch: (url: string, data: any, options: any) => {
        return Promise.resolve();
    }
};