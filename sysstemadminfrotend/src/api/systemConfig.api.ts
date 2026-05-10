import { apiRequest } from "@/lib/api";

const BASE = "/api/admin/system-config";

export interface SystemConfigEntry {
  id: string;
  configGroup: string;
  configKey: string;
  configValue: string;
  description: string | null;
  valueType: string;
  isActive: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupSummary {
  group: string;
  count: number;
  activeCount: number;
}

export const systemConfigApi = {
  getAll: (group?: string, isActive?: boolean) => {
    const params = new URLSearchParams();
    if (group) params.set("group", group);
    if (isActive !== undefined) params.set("isActive", String(isActive));
    const qs = params.toString();
    return apiRequest(`${BASE}${qs ? "?" + qs : ""}`);
  },

  getGroupSummaries: () => apiRequest(`${BASE}/groups`),

  getGroupConfigs: (group: string) => apiRequest(`${BASE}/${group}`),

  getConfig: (group: string, key: string) => apiRequest(`${BASE}/${group}/${key}`),

  create: (data: {
    group: string;
    key: string;
    value: string;
    description?: string;
    valueType?: string;
  }) =>
    apiRequest(BASE, { method: "POST", body: JSON.stringify(data) }),

  update: (
    group: string,
    key: string,
    data: { value: string; description?: string; valueType?: string }
  ) =>
    apiRequest(`${BASE}/${group}/${key}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deactivate: (group: string, key: string) =>
    apiRequest(`${BASE}/${group}/${key}/deactivate`, { method: "PATCH" }),

  reactivate: (group: string, key: string) =>
    apiRequest(`${BASE}/${group}/${key}/reactivate`, { method: "PATCH" }),

  delete: (group: string, key: string) =>
    apiRequest(`${BASE}/${group}/${key}`, { method: "DELETE" }),

  refreshCache: () =>
    apiRequest(`${BASE}/cache/refresh`, { method: "POST" }),

  getCacheStats: () => apiRequest(`${BASE}/cache/stats`),
};
