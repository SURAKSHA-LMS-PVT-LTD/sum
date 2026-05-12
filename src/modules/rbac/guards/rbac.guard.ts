import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeaturePermissionsService } from '../services/feature-permissions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstituteUserEntity } from '../../institute_mudules/institue_user/entities/institue_user.entity';
import { PERMISSION_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: FeaturePermissionsService,
    @InjectRepository(InstituteUserEntity)
    private readonly iuRepo: Repository<InstituteUserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId ?? request.user?.sub;
    const instituteId = request.params?.id ?? request.user?.selectedInstituteId;

    if (!userId || !instituteId) throw new ForbiddenException('Missing user or institute context');

    const iu = await this.iuRepo.findOne({
      where: { userId: String(userId), instituteId: String(instituteId) },
      select: ['primaryUserTypeId'],
    });

    if (!iu?.primaryUserTypeId) throw new ForbiddenException('User has no user type assigned');

    const matrix = await this.permissionsService.getMatrix(
      String(instituteId),
      String(iu.primaryUserTypeId),
    );

    const perm = matrix[requirement.feature];
    if (!perm) throw new ForbiddenException(`No permissions defined for feature: ${requirement.feature}`);

    const actionKey = `can${requirement.action.charAt(0).toUpperCase()}${requirement.action.slice(1)}` as keyof typeof perm;
    if (!perm[actionKey]) {
      throw new ForbiddenException(`Action "${requirement.action}" not allowed on feature "${requirement.feature}"`);
    }

    return true;
  }
}
