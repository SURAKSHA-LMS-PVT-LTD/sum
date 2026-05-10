import { enhancedCachedClient, EnhancedCacheOptions } from './enhancedCachedClient';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StudyMaterial {
  id: string;
  instituteId: string;
  classId?: string;
  subjectId: string;
  title: string;
  description?: string;
  materialType: 'FILE' | 'LINK';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  source: string; // 'S3' | 'GOOGLE_DRIVE' | 'GOOGLE_DRIVE_INSTITUTE' | 'EXTERNAL_LINK'
  driveFileId?: string;
  driveWebViewLink?: string;
  thumbnailUrl?: string;
  downloadEnabled: boolean;
  shareEnabled: boolean;
  isActive: boolean;
  sortOrder: number;
  createdById?: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface StudyMaterialCreateData {
  instituteId: string;
  classId?: string;
  subjectId: string;
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
}

export interface StudyMaterialQueryParams {
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ── API ─────────────────────────────────────────────────────────────────────

const BASE = '/study-materials';

class StudyMaterialApi {
  async list(
    params?: StudyMaterialQueryParams,
    forceRefresh = false,
  ): Promise<{ data: StudyMaterial[]; total: number }> {
    return enhancedCachedClient.get<{ data: StudyMaterial[]; total: number }>(
      BASE,
      params as Record<string, any>,
      {
        forceRefresh,
        ttl: 5,
        useStaleWhileRevalidate: true,
        instituteId: params?.instituteId,
        classId: params?.classId,
        subjectId: params?.subjectId,
      },
    );
  }

  async getById(id: string, forceRefresh = false): Promise<StudyMaterial> {
    return enhancedCachedClient.get<StudyMaterial>(`${BASE}/${id}`, undefined, {
      forceRefresh,
      ttl: 5,
    });
  }

  async create(data: StudyMaterialCreateData): Promise<StudyMaterial> {
    return enhancedCachedClient.post<StudyMaterial>(BASE, data);
  }

  async update(
    id: string,
    data: Partial<StudyMaterialCreateData>,
  ): Promise<StudyMaterial> {
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
