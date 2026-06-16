import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DesignTemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type DesignOutputType = 'PNG' | 'PDF' | 'WHATSAPP' | 'PRINT';

export interface DesignTemplate {
  id: string;
  instituteId: string;
  name: string;
  definition: Record<string, any>;
  status: DesignTemplateStatus;
  costPng: number;
  costPdf: number;
  costWhatsapp: number;
  costPrint: number;
  allowPng: boolean;
  allowPdf: boolean;
  allowWhatsapp: boolean;
  allowPrint: boolean;
  whatsappTtlDays?: number;
  rejectionReason?: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewCostResult {
  userCount: number;
  unitCost: number;
  totalCost: number;
  balance: number;
  sufficient: boolean;
}

export interface CommitGenerationResult {
  recordId: string;
  definition: Record<string, any>;
  transactionId: string;
  unitCost: number;
  totalCost: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const instituteDesignsApi = {
  listTemplates: (instituteId: string): Promise<DesignTemplate[]> =>
    apiClient.get(`/institutes/${instituteId}/design-templates`)
      .then((res: any) => Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []),

  createTemplate: (instituteId: string, data: { name: string; definition: Record<string, any> }): Promise<DesignTemplate> =>
    apiClient.post(`/institutes/${instituteId}/design-templates`, data).then((r: any) => r?.data ?? r),

  updateTemplate: (
    instituteId: string,
    templateId: string,
    data: { name: string; definition: Record<string, any> },
  ): Promise<DesignTemplate> =>
    apiClient.put(`/institutes/${instituteId}/design-templates/${templateId}`, data).then((r: any) => r?.data ?? r),

  deleteTemplate: (instituteId: string, templateId: string): Promise<void> =>
    apiClient.delete(`/institutes/${instituteId}/design-templates/${templateId}`),

  submitForReview: (instituteId: string, templateId: string): Promise<DesignTemplate> =>
    apiClient.put(`/institutes/${instituteId}/design-templates/${templateId}/submit-for-review`, {})
      .then((r: any) => r?.data ?? r),

  previewCost: (
    instituteId: string,
    templateId: string,
    outputType: DesignOutputType,
    userIds: string[],
  ): Promise<PreviewCostResult> =>
    apiClient.post(`/institutes/${instituteId}/design-templates/${templateId}/preview-cost`, {
      outputType, userIds,
    }).then((r: any) => r?.data ?? r),

  commitGeneration: (
    instituteId: string,
    templateId: string,
    outputType: DesignOutputType,
    userIds: string[],
  ): Promise<CommitGenerationResult> =>
    apiClient.post(`/institutes/${instituteId}/design-templates/${templateId}/generate`, {
      outputType, userIds,
    }).then((r: any) => r?.data ?? r),

  reportResult: (
    instituteId: string,
    recordId: string,
    successCount: number,
    failCount: number,
  ): Promise<{ refunded: number }> =>
    apiClient.post(`/institutes/${instituteId}/design-templates/generations/${recordId}/result`, {
      successCount, failCount,
    }).then((r: any) => r?.data ?? r),
};
