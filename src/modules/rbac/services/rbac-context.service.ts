import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstituteUserEntity } from '../../institute_mudules/institue_user/entities/institue_user.entity';
import { InstituteUserType } from '../entities/institute-user-type.entity';
import { FeaturePermissionsService, PermissionMatrix } from './feature-permissions.service';

export interface UserRbacContext {
  userTypeId: string | null;
  userTypeName: string | null;
  userTypeSlug: string | null;
  userTypeColor: string | null;
  userTypeIcon: string | null;
  permissions: PermissionMatrix;
  legacyUserType: string | null;
}

@Injectable()
export class RbacContextService {
  constructor(
    @InjectRepository(InstituteUserEntity)
    private readonly iuRepo: Repository<InstituteUserEntity>,
    @InjectRepository(InstituteUserType)
    private readonly utRepo: Repository<InstituteUserType>,
    private readonly permissionsService: FeaturePermissionsService,
  ) {}

  async getContextForUser(userId: string, instituteId: string): Promise<UserRbacContext> {
    const iu = await this.iuRepo.findOne({
      where: { userId, instituteId },
      select: ['userId', 'instituteId', 'primaryUserTypeId', 'instituteUserType'],
    });

    if (!iu || !iu.primaryUserTypeId) {
      return {
        userTypeId: null,
        userTypeName: null,
        userTypeSlug: null,
        userTypeColor: null,
        userTypeIcon: null,
        permissions: {},
        legacyUserType: iu?.instituteUserType ?? null,
      };
    }

    const ut = await this.utRepo.findOne({ where: { id: iu.primaryUserTypeId } });
    if (!ut) {
      return {
        userTypeId: null,
        userTypeName: null,
        userTypeSlug: null,
        userTypeColor: null,
        userTypeIcon: null,
        permissions: {},
        legacyUserType: iu.instituteUserType ?? null,
      };
    }

    const permissions = await this.permissionsService.getMatrix(instituteId, iu.primaryUserTypeId);

    return {
      userTypeId: ut.id,
      userTypeName: ut.name,
      userTypeSlug: ut.slug,
      userTypeColor: ut.color ?? null,
      userTypeIcon: ut.icon ?? null,
      permissions,
      legacyUserType: iu.instituteUserType ?? null,
    };
  }
}
