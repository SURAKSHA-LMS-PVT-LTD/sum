import { enhancedCachedClient } from './enhancedCachedClient';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StudyMaterialFolder {
  id: string;
  instituteId: string;
  classId: string;
  parentId?: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  children?: StudyMaterialFolder[];
}

export interface StudyMaterial {
  id: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  folderId?: string;
  folder?: StudyMaterialFolder;
  title: string;
  description?: string;
  materialType: 'FILE' | 'LINK';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  source: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  thumbnailUrl?: string;
  downloadEnabled: boolean;
  shareEnabled: boolean;
  isActive: boolean;
  sortOrder: number;
  accessLevel: 'ANYONE' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  requiredPaymentId?: string;
  _paymentVerified?: boolean; // injected server-side for students
  createdById?: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface StudyMaterialCreateData {
  instituteId: string;
  classId?: string;
  subjectId?: string;
  folderId?: string;
  title: string;
  description?: string;
  materialType?: 'FILE' | 'LINK';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  source?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  thumbnailUrl?: string;
  downloadEnabled?: boolean;
  shareEnabled?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  accessLevel?: 'ANYONE' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  requiredPaymentId?: string;
}

export interface StudyMaterialQueryParams {
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  folderId?: string; // 'root' for unfoldered, specific ID, or omit for all
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ── API ─────────────────────────────────────────────────────────────────────

const BASE = '/study-materials';

class StudyMaterialApi {
  // ── Folders ────────────────────────────────────────────────────────────────

  async listFolders(instituteId: string, classId: string, forceRefresh = false): Promise<StudyMaterialFolder[]> {
    return enhancedCachedClient.get<StudyMaterialFolder[]>(
      `${BASE}/folders`,
      { instituteId, classId },
      { forceRefresh, ttl: 10, instituteId, classId },
    );
  }

  async createFolder(data: { instituteId: string; classId: string; parentId?: string; name: string; description?: string; sortOrder?: number }): Promise<StudyMaterialFolder> {
    return enhancedCachedClient.post<StudyMaterialFolder>(`${BASE}/folders`, data);
  }

  async updateFolder(id: string, data: { name?: string; description?: string; sortOrder?: number }): Promise<StudyMaterialFolder> {
    return enhancedCachedClient.patch<StudyMaterialFolder>(`${BASE}/folders/${id}`, data);
  }

  async deleteFolder(id: string): Promise<void> {
    return enhancedCachedClient.delete<void>(`${BASE}/folders/${id}`);
  }

  // ── Materials ──────────────────────────────────────────────────────────────

  async list(params?: StudyMaterialQueryParams, forceRefresh = false): Promise<{ data: StudyMaterial[]; total: number }> {
    return enhancedCachedClient.get<{ data: StudyMaterial[]; total: number }>(
      BASE,
      params as Record<string, any>,
      { forceRefresh, ttl: 5, useStaleWhileRevalidate: true, instituteId: params?.instituteId, classId: params?.classId },
    );
  }

  async getById(id: string, forceRefresh = false): Promise<StudyMaterial> {
    return enhancedCachedClient.get<StudyMaterial>(`${BASE}/${id}`, undefined, { forceRefresh, ttl: 5 });
  }

  async checkAccess(id: string): Promise<{ hasAccess: boolean; paymentId?: string }> {
    return enhancedCachedClient.get<{ hasAccess: boolean; paymentId?: string }>(`${BASE}/${id}/check-access`, undefined, { ttl: 30 });
  }

  async create(data: StudyMaterialCreateData): Promise<StudyMaterial> {
    return enhancedCachedClient.post<StudyMaterial>(BASE, data);
  }

  async update(id: string, data: Partial<StudyMaterialCreateData>): Promise<StudyMaterial> {
    return enhancedCachedClient.patch<StudyMaterial>(`${BASE}/${id}`, data);
  }

  async remove(id: string): Promise<void> {
    return enhancedCachedClient.delete<void>(`${BASE}/${id}`);
  }

  async toggleActive(id: string): Promise<StudyMaterial> {
    return enhancedCachedClient.patch<StudyMaterial>(`${BASE}/${id}/toggle-active`);
  }

  async reorder(ids: string[]): Promise<void> {
    return enhancedCachedClient.post<void>(`${BASE}/reorder`, { ids });
  }
}

export const studyMaterialApi = new StudyMaterialApi();
