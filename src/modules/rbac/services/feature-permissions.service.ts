import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InstituteFeaturePermission } from '../entities/institute-feature-permission.entity';
import { BulkUpdatePermissionsDto } from '../dto/user-type.dto';

export interface PermissionMatrix {
  [featureKey: string]: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  };
}

const CACHE_TTL = 3600; // 1 hour in seconds

@Injectable()
export class FeaturePermissionsService {
  constructor(
    @InjectRepository(InstituteFeaturePermission)
    private readonly repo: Repository<InstituteFeaturePermission>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private cacheKey(instituteId: string, userTypeId: string): string {
    return `rbac:inst:${instituteId}:ut:${userTypeId}`;
  }

  async getMatrix(instituteId: string, userTypeId: string): Promise<PermissionMatrix> {
    const key = this.cacheKey(instituteId, userTypeId);

    const cached = await this.cache.get<PermissionMatrix>(key);
    if (cached) return cached;

    const rows = await this.repo.find({ where: { userTypeId } });
    const matrix: PermissionMatrix = {};
    for (const row of rows) {
      matrix[row.featureKey] = {
        canView: !!row.canView,
        canCreate: !!row.canCreate,
        canUpdate: !!row.canUpdate,
        canDelete: !!row.canDelete,
        canReport: !!row.canReport,
      };
    }

    await this.cache.set(key, matrix, CACHE_TTL);
    return matrix;
  }

  async bulkUpdate(
    instituteId: string,
    userTypeId: string,
    dto: BulkUpdatePermissionsDto,
  ): Promise<void> {
    const em = this.repo.manager;
    const entries = Object.entries(dto.permissions);
    if (entries.length === 0) return;

    await Promise.all(
      entries.map(([featureKey, perms]) =>
        em.query(
          `INSERT INTO institute_feature_permissions
             (user_type_id, feature_key, can_view, can_create, can_update, can_delete, can_report, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             can_view = VALUES(can_view),
             can_create = VALUES(can_create),
             can_update = VALUES(can_update),
             can_delete = VALUES(can_delete),
             can_report = VALUES(can_report),
             updated_at = NOW()`,
          [
            userTypeId,
            featureKey,
            perms.canView ? 1 : 0,
            perms.canCreate ? 1 : 0,
            perms.canUpdate ? 1 : 0,
            perms.canDelete ? 1 : 0,
            perms.canReport ? 1 : 0,
          ],
        ),
      ),
    );

    await this.cache.del(this.cacheKey(instituteId, userTypeId));
  }

  async invalidateForInstitute(instituteId: string, userTypeIds: string[]): Promise<void> {
    await Promise.all(
      userTypeIds.map(id => this.cache.del(this.cacheKey(instituteId, id))),
    );
  }

  async getPermissionsForUserType(userTypeId: string): Promise<InstituteFeaturePermission[]> {
    return this.repo.find({ where: { userTypeId } });
  }
}
